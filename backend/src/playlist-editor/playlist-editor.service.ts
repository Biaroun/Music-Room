import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Playlist, PlaylistLicenseMode } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackDto } from './dto/add-track.dto';

// small public info of an editor (no email no tokens)
export type CollaboratorSummary = { id: number; username: string; avatar: string | null };

/** etat complet diffuse a la room par PlaylistEditorGateway */
export type PlaylistState = {
    id: number;
    name: string;
    isPublic: boolean;
    licenseMode: PlaylistLicenseMode;
    version: number;
    owner: { id: number; username: string };
    collaborators: CollaboratorSummary[];
    tracks: PlaylistTrack[];
    updatedAt: number;
};

// playlist logic (crud tracks editors reorder and the rights)
@Injectable()
export class PlaylistEditorService {
    constructor(
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        @InjectRepository(PlaylistTrack) private tracks: Repository<PlaylistTrack>,
        @InjectRepository(PlaylistCollaborator) private collaborators: Repository<PlaylistCollaborator>,
        @InjectRepository(User) private users: Repository<User>,
    ) {}

    // create a playlist (public by default)
    async create(ownerId: number, dto: CreatePlaylistDto) {
        const playlist = this.playlists.create({
            name: dto.name,
            isPublic: dto.isPublic ?? true,
            owner: { id: ownerId } as any,
        });
        return this.playlists.save(playlist);
    }

    async findMine(userId: number) {
        // tracks charge juste pour le compteur affiche cote mobile
        const owned = await this.playlists.find({
            where: { owner: { id: userId } },
            relations: { tracks: true },
            order: { createdAt: 'DESC' },
        });

        const rows = await this.collaborators.find({
            where: { collaborator: { id: userId } },
            relations: { playlist: true },
        });
        const sharedIds = rows.map((row) => row.playlist.id);
        // no shared id = on skip the query (In([]) is useless)
        const shared = sharedIds.length
            ? await this.playlists.find({
                  where: { id: In(sharedIds) },
                  relations: { tracks: true, owner: true },
                  select: { owner: { id: true, username: true } },
                  order: { createdAt: 'DESC' },
              })
            : [];

        const publicOthers = await this.playlists.find({
            where: {
                isPublic: true,
                owner: { id: Not(userId) },
                ...(sharedIds.length ? { id: Not(In(sharedIds)) } : {}),
            },
            relations: { tracks: true, owner: true },
            select: { owner: { id: true, username: true } },
            order: { createdAt: 'DESC' },
        });

        // isOwner : le mobile masque renommage, visibilite et suppression dessus
        return [
            ...owned.map((playlist) => ({ ...playlist, isOwner: true })),
            ...[...shared, ...publicOthers].map((playlist) => ({ ...playlist, isOwner: false })),
        ];
    }

    // one playlist with its tracks sorted by position
    async findOne(id: number, requesterId: number) {
        await this.assertCanView(id, requesterId);
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        playlist.tracks.sort((a, b) => a.position - b.position);
        return { ...playlist, isOwner: playlist.owner.id === requesterId };
    }

    // load the playlist and throw if im not the owner
    private async findOwned(id: number, ownerId: number): Promise<Playlist> {
        const playlist = await this.load(id);
        if (playlist.owner.id !== ownerId) throw new ForbiddenException('Not your playlist');
        return playlist;
    }

    // true if userId was invited as editor
    private isCollaborator(playlistId: number, userId: number): Promise<boolean> {
        return this.collaborators
            .findOne({ where: { playlist: { id: playlistId }, collaborator: { id: userId } } })
            .then((row) => !!row);
    }

    // select restreint sur owner : sinon typeorm renvoie tout le User, tokens
    // de reset et de verification compris
    private async load(id: number): Promise<Playlist> {
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        return playlist;
    }

    /**
     * droit d'ecriture, deux axes qui se composent comme dans
     * EventService.assertCanVote : d'abord la visibilite, on n'edite pas ce
     * qu'on n'a pas le droit de voir, puis la licence. en OPEN tout spectateur
     * edite, en INVITE_ONLY seuls le proprietaire et les invites.
     */
    async assertCanEdit(playlistId: number, userId: number): Promise<Playlist> {
        const playlist = await this.assertCanView(playlistId, userId);
        if (playlist.licenseMode === PlaylistLicenseMode.OPEN) return playlist;
        if (playlist.owner.id === userId) return playlist;
        if (await this.isCollaborator(playlistId, userId)) return playlist;
        throw new ForbiddenException('You are not an editor of this playlist');
    }

    /** droit de lecture : playlist publique, proprietaire ou collaborateur */
    async assertCanView(playlistId: number, userId: number): Promise<Playlist> {
        const playlist = await this.load(playlistId);
        if (playlist.isPublic) return playlist;
        if (playlist.owner.id === userId) return playlist;
        if (await this.isCollaborator(playlistId, userId)) return playlist;
        throw new ForbiddenException('This playlist is private');
    }

    // rename or change visibility or license (owner only)
    async update(id: number, ownerId: number, dto: UpdatePlaylistDto) {
        const playlist = await this.findOwned(id, ownerId);
        Object.assign(playlist, dto);
        return this.playlists.save(playlist);
    }

    // delete the playlist (owner only tracks go with the cascade)
    async remove(id: number, ownerId: number): Promise<void> {
        const playlist = await this.findOwned(id, ownerId);
        await this.playlists.remove(playlist);
    }

    /**
     * etat diffuse a toute la room. identique pour tous les spectateurs, au
     * contraire du board de track-vote qui porte un myVote par utilisateur,
     * donc calcule une seule fois par diffusion.
     */
    async getState(playlistId: number): Promise<PlaylistState> {
        const playlist = await this.playlists.findOne({
            where: { id: playlistId },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        playlist.tracks.sort((a, b) => a.position - b.position);

        return {
            id: playlist.id,
            name: playlist.name,
            isPublic: playlist.isPublic,
            licenseMode: playlist.licenseMode,
            version: playlist.version,
            owner: { id: playlist.owner.id, username: playlist.owner.username },
            collaborators: await this.collaboratorSummaries(playlistId),
            tracks: playlist.tracks,
            updatedAt: Date.now(),
        };
    }

    // editors of the playlist with only id username avatar
    private async collaboratorSummaries(playlistId: number): Promise<CollaboratorSummary[]> {
        const rows = await this.collaborators.find({
            where: { playlist: { id: playlistId } },
            relations: { collaborator: true },
            select: { collaborator: { id: true, username: true, avatar: true } },
        });
        return rows.map((row) => ({
            id: row.collaborator.id,
            username: row.collaborator.username,
            avatar: row.collaborator.avatar ?? null,
        }));
    }

    // editors list (need the view right)
    async listCollaborators(playlistId: number, userId: number): Promise<CollaboratorSummary[]> {
        await this.assertCanView(playlistId, userId);
        return this.collaboratorSummaries(playlistId);
    }

    // invite an editor (owner only)
    async addCollaborator(playlistId: number, ownerId: number, userId: number) {
        await this.findOwned(playlistId, ownerId);
        if (userId === ownerId) throw new BadRequestException('The owner is already an editor');

        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // idempotent : reinviter ne doit pas casser, @Unique protege la base
        // pas l'appelant
        const existing = await this.collaborators.findOne({
            where: { playlist: { id: playlistId }, collaborator: { id: userId } },
        });
        if (existing) return existing;

        return this.collaborators.save(
            this.collaborators.create({
                playlist: { id: playlistId } as any,
                collaborator: { id: userId } as any,
            }),
        );
    }

    // remove an editor (owner only)
    async removeCollaborator(playlistId: number, ownerId: number, userId: number): Promise<void> {
        await this.findOwned(playlistId, ownerId);
        await this.collaborators.delete({ playlist: { id: playlistId }, collaborator: { id: userId } });
    }

    // version + 1 after each change (for the reorder conflicts)
    private bumpVersion(playlistId: number) {
        return this.playlists.increment({ id: playlistId }, 'version', 1);
    }

    // add a deezer track at the end of the playlist
    async addTrack(playlistId: number, userId: number, dto: AddTrackDto) {
        const playlist = await this.assertCanEdit(playlistId, userId);

        // unicite par deezerId et par playlist : le meme titre peut vivre dans
        // plusieurs playlists mais pas deux fois dans la meme. compare sur
        // l'id, deux homonymes restent deux morceaux differents
        const duplicate = await this.tracks.findOne({
            where: { playlist: { id: playlist.id }, deezerId: dto.deezerId },
        });
        if (duplicate) throw new ConflictException('This track is already in the playlist');

        // count = next position because positions start at 0
        const position = await this.tracks.count({ where: { playlist: { id: playlist.id } } });
        // juste l'id pour la relation, inutile de renvoyer toute la playlist
        const track = this.tracks.create({ ...dto, position, playlist: { id: playlist.id } as any });
        const saved = await this.tracks.save(track);
        await this.bumpVersion(playlist.id);
        return saved;
    }

    // remove a track from the playlist
    async removeTrack(playlistId: number, trackId: number, userId: number): Promise<void> {
        await this.assertCanEdit(playlistId, userId);
        const track = await this.tracks.findOne({ where: { id: trackId, playlist: { id: playlistId } } });
        if (!track) throw new NotFoundException('Track not found in this playlist');
        await this.tracks.remove(track);
        await this.bumpVersion(playlistId);
    }

    /**
     * expectedVersion absent : dernier ecrit gagne, pour le repli rest. fourni,
     * il attrape le cas que sameSet laisse passer, quelqu'un ayant reordonne
     * pendant le deplacement avec le meme jeu d'ids.
     * en transaction : un Promise.all d'updates pouvait laisser un ordre a
     * moitie applique si une requete echouait.
     */
    async reorder(playlistId: number, userId: number, trackIds: number[], expectedVersion?: number) {
        await this.assertCanEdit(playlistId, userId);

        // 1) check version 2) check same set of ids 3) write the new positions 4) version + 1
        await this.playlists.manager.transaction(async (em) => {
            const playlist = await em.findOne(Playlist, { where: { id: playlistId } });
            if (!playlist) throw new NotFoundException('Playlist not found');
            if (expectedVersion != null && expectedVersion !== playlist.version) {
                throw new ConflictException('Playlist changed while you were reordering');
            }

            const currentTracks = await em.find(PlaylistTrack, { where: { playlist: { id: playlistId } } });
            // sort both lists to compare the ids without the order
            const currentIds = currentTracks.map((t) => t.id).sort((a, b) => a - b);
            const requestedIds = [...trackIds].sort((a, b) => a - b);
            const sameSet =
                currentIds.length === requestedIds.length && currentIds.every((id, i) => id === requestedIds[i]);
            if (!sameSet) {
                throw new ForbiddenException('trackIds must match exactly the tracks currently in the playlist');
            }

            for (const [index, trackId] of trackIds.entries()) {
                // the index in the array = the new position
                await em.update(PlaylistTrack, trackId, { position: index });
            }
            await em.increment(Playlist, { id: playlistId }, 'version', 1);
        });

        return this.getState(playlistId);
    }
}
