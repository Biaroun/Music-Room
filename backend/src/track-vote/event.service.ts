import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventLicenseMode, EventVisibility } from './event.entity';
import { EventInvite } from './event-invite.entity';
import { Playlist } from '../playlist-editor/playlist.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { haversineDistanceMeters } from './geo.util';
import { SubscriptionService } from '../subscription/subscription.service';

export type VoterPosition = { latitude: number; longitude: number };

// Ce que le front a besoin de savoir pour afficher correctement un event sans
// deviner : suis-je le createur, suis-je invite, et puis-je voter maintenant
// (independamment de la position, verifiee seulement au moment du vote pour
// les events geo-restreints).
export type EventForUser = Event & {
    isOwner: boolean;
    isInvited: boolean;
    canVote: boolean;
};

@Injectable()
export class EventService {
    constructor(
        @InjectRepository(Event) private events: Repository<Event>,
        @InjectRepository(EventInvite) private invites: Repository<EventInvite>,
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        private subscription: SubscriptionService,
    ) {}

    /**
     * bonus VI.3 : creer et gerer un event est reserve au plan premium (pas de
     * paiement reel, juste la bascule d'etat sur l'utilisateur). rejoindre et
     * voter reste ouvert a tous, gate uniquement la creation/gestion.
     */
    private async assertPremium(userId: number): Promise<void> {
        if (!(await this.subscription.isPremium(userId))) {
            throw new ForbiddenException('Creating and managing Track Vote events requires a Premium subscription');
        }
    }

    async create(ownerId: number, dto: CreateEventDto): Promise<Event> {
        await this.assertPremium(ownerId);
        const playlist = await this.playlists.findOne({ where: { id: dto.playlistId } });
        if (!playlist) throw new NotFoundException('Playlist not found');

        const event = this.events.create({
            name: dto.name,
            playlist: { id: dto.playlistId } as Playlist,
            owner: { id: ownerId } as any,
            visibility: dto.visibility ?? EventVisibility.PUBLIC,
            licenseMode: dto.licenseMode ?? EventLicenseMode.OPEN,
            licenseLatitude: dto.licenseLatitude ?? null,
            licenseLongitude: dto.licenseLongitude ?? null,
            licenseRadiusMeters: dto.licenseRadiusMeters ?? null,
            licenseStartsAt: dto.licenseStartsAt ? new Date(dto.licenseStartsAt) : null,
            licenseEndsAt: dto.licenseEndsAt ? new Date(dto.licenseEndsAt) : null,
        });
        return this.events.save(event);
    }

    /** Evenements publics + les miens + ceux ou je suis invite, avec mon statut sur chacun. */
    async findVisible(userId: number): Promise<EventForUser[]> {
        const invited = await this.invites.find({
            where: { invitee: { id: userId } },
            relations: { event: true },
        });
        const invitedEventIds = new Set(invited.map((i) => i.event.id));

        const events = await this.events.find({
            where: [
                { visibility: EventVisibility.PUBLIC },
                { owner: { id: userId } },
                ...(invitedEventIds.size ? [...invitedEventIds].map((id) => ({ id })) : []),
            ],
            relations: { owner: true, playlist: true },
            select: { owner: { id: true, username: true } },
            order: { createdAt: 'DESC' },
        });

        return events.map((event) => {
            const isOwner = event.owner.id === userId;
            const isInvited = !isOwner && invitedEventIds.has(event.id);
            return { ...event, isOwner, isInvited, canVote: this.computeCanVote(event, isOwner, isInvited) };
        });
    }

    /** Un seul event, enrichi du meme statut que findVisible. 404 si non visible. */
    async findOneForUser(id: number, userId: number): Promise<EventForUser> {
        const event = await this.assertCanView(id, userId);
        const isOwner = event.owner.id === userId;
        const isInvited = !isOwner && (await this.isInvited(id, userId));
        return { ...event, isOwner, isInvited, canVote: this.computeCanVote(event, isOwner, isInvited) };
    }

    /**
     * Peut voter "en l'etat" sans tenir compte de la position (verifiee
     * seulement au moment reel du vote pour les events geo-restreints) :
     * sert a afficher un badge, pas a autoriser une action.
     */
    private computeCanVote(event: Event, isOwner: boolean, isInvited: boolean): boolean {
        if (event.licenseMode === EventLicenseMode.OPEN) return true;
        if (event.licenseMode === EventLicenseMode.INVITE_ONLY) return isOwner || isInvited;

        const now = new Date();
        if (event.licenseStartsAt && now < event.licenseStartsAt) return false;
        if (event.licenseEndsAt && now > event.licenseEndsAt) return false;
        return true;
    }

    async findOne(id: number): Promise<Event> {
        const event = await this.events.findOne({
            where: { id },
            relations: { owner: true, playlist: true },
            select: { owner: { id: true, username: true } },
        });
        if (!event) throw new NotFoundException('Event not found');
        return event;
    }

    private async findManageable(id: number, ownerId: number): Promise<Event> {
        const event = await this.findOne(id);
        if (event.owner.id !== ownerId) throw new ForbiddenException('Not your event');
        // un event cree pendant l'abonnement reste a l'owner, mais devient
        // ineditable s'il resilie : la gestion exige le plan premium a chaque
        // action, pas seulement a la creation.
        await this.assertPremium(ownerId);
        return event;
    }

    async update(id: number, ownerId: number, dto: UpdateEventDto): Promise<Event> {
        const event = await this.findManageable(id, ownerId);
        Object.assign(event, {
            ...dto,
            licenseStartsAt: dto.licenseStartsAt ? new Date(dto.licenseStartsAt) : event.licenseStartsAt,
            licenseEndsAt: dto.licenseEndsAt ? new Date(dto.licenseEndsAt) : event.licenseEndsAt,
        });
        return this.events.save(event);
    }

    async remove(id: number, ownerId: number): Promise<void> {
        const event = await this.findManageable(id, ownerId);
        await this.events.remove(event);
    }

    async invite(eventId: number, ownerId: number, inviteeId: number): Promise<EventInvite> {
        await this.findManageable(eventId, ownerId);
        const existing = await this.invites.findOne({
            where: { event: { id: eventId }, invitee: { id: inviteeId } },
        });
        if (existing) return existing;

        const invite = this.invites.create({
            event: { id: eventId } as Event,
            invitee: { id: inviteeId } as any,
        });
        return this.invites.save(invite);
    }

    async uninvite(eventId: number, ownerId: number, inviteeId: number): Promise<void> {
        await this.findManageable(eventId, ownerId);
        await this.invites.delete({ event: { id: eventId }, invitee: { id: inviteeId } });
    }

    async listInvited(eventId: number, ownerId: number) {
        await this.findManageable(eventId, ownerId);
        return this.invites.find({ where: { event: { id: eventId } }, relations: { invitee: true } });
    }

    private async isInvited(eventId: number, userId: number): Promise<boolean> {
        const invite = await this.invites.findOne({
            where: { event: { id: eventId }, invitee: { id: userId } },
        });
        return !!invite;
    }

    /**
     * Peut-on meme voir/trouver cet event ? Public -> tout le monde. Prive ->
     * proprietaire ou invite, sinon 404 (pas 403) pour ne pas laisser deviner
     * qu'un event prive existe.
     */
    async assertCanView(eventId: number, userId: number): Promise<Event> {
        const event = await this.findOne(eventId);
        if (event.visibility === EventVisibility.PUBLIC || event.owner.id === userId) return event;
        if (await this.isInvited(eventId, userId)) return event;
        throw new NotFoundException('Event not found');
    }

    /**
     * Etant donne qu'on peut voir l'event, peut-on y voter maintenant ? Ne
     * jamais appeler sans assertCanView prealable.
     */
    async assertCanVote(eventId: number, userId: number, position?: VoterPosition): Promise<Event> {
        const event = await this.assertCanView(eventId, userId);

        if (event.licenseMode === EventLicenseMode.OPEN) return event;

        if (event.licenseMode === EventLicenseMode.INVITE_ONLY) {
            if (event.owner.id === userId || (await this.isInvited(eventId, userId))) return event;
            throw new ForbiddenException('You are not invited to vote in this event');
        }

        // GEO_TIME_RESTRICTED
        const now = new Date();
        if (event.licenseStartsAt && now < event.licenseStartsAt) {
            throw new ForbiddenException('Voting has not started yet for this event');
        }
        if (event.licenseEndsAt && now > event.licenseEndsAt) {
            throw new ForbiddenException('Voting has ended for this event');
        }
        if (!position) {
            throw new BadRequestException('Your location is required to vote in this event');
        }
        if (event.licenseLatitude == null || event.licenseLongitude == null || event.licenseRadiusMeters == null) {
            throw new ForbiddenException('This event has no valid location configured');
        }
        const distance = haversineDistanceMeters(position, {
            latitude: event.licenseLatitude,
            longitude: event.licenseLongitude,
        });
        if (distance > event.licenseRadiusMeters) {
            throw new ForbiddenException('You are outside the allowed area for this event');
        }
        return event;
    }
}
