import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Vote } from './vote.entity';
import { PlaylistTrack } from '../playlist-editor/playlist-track.entity';
import { Playlist } from '../playlist-editor/playlist.entity';
import { EventService } from './event.service';
import { AddTrackDto } from '../playlist-editor/dto/add-track.dto';

// Duree standard d'un extrait Deezer : sert de duree de lecture pour la file
// d'attente, faute de duree exacte stockee par morceau.
export const PREVIEW_DURATION_MS = 30_000;

export type BoardTrack = {
    trackId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    voteCount: number;
    myVote: boolean;
};

export type NowPlaying = {
    trackId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    previewUrl: string;
    startedAt: number;
    durationMs: number;
};

export type Board = {
    tracks: BoardTrack[];
    nowPlaying: NowPlaying | null;
    updatedAt: number;
};

type NowPlayingState = { trackId: number; startedAt: number };

@Injectable()
export class TrackVoteService {
    constructor(
        @InjectRepository(Vote) private votes: Repository<Vote>,
        @InjectRepository(PlaylistTrack) private tracks: Repository<PlaylistTrack>,
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        private eventService: EventService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    // La verification d'acces (visibilite/licence) reste dans EventService, ici
    // on suppose qu'elle a deja ete faite par l'appelant (controller/gateway).

    async suggestTrack(eventId: number, dto: AddTrackDto): Promise<PlaylistTrack> {
        const event = await this.eventService.findOne(eventId);
        const position = await this.tracks.count({ where: { playlist: { id: event.playlist.id } } });
        const track = this.tracks.create({ ...dto, position, playlist: { id: event.playlist.id } as any });
        return this.tracks.save(track);
    }

    /**
     * Copie tous les morceaux d'une de mes playlists dans la playlist de
     * l'event, en une seule ecriture (un seul broadcast declenche par
     * l'appelant apres, pas un par morceau). Les morceaux deja presents dans
     * l'event (meme deezerId) ne sont pas dupliques.
     */
    async importPlaylist(eventId: number, requesterId: number, sourcePlaylistId: number): Promise<{ added: number }> {
        const event = await this.eventService.findOne(eventId);
        const source = await this.playlists.findOne({
            where: { id: sourcePlaylistId },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true } },
        });
        if (!source) throw new NotFoundException('Playlist not found');
        if (source.owner.id !== requesterId) throw new ForbiddenException('Not your playlist');

        const existing = await this.tracks.find({ where: { playlist: { id: event.playlist.id } } });
        const existingDeezerIds = new Set(existing.map((t) => t.deezerId));
        let position = existing.length;

        const rows = source.tracks
            .filter((t) => !existingDeezerIds.has(t.deezerId))
            .map((t) =>
                this.tracks.create({
                    deezerId: t.deezerId,
                    title: t.title,
                    artist: t.artist,
                    artistId: t.artistId,
                    cover: t.cover,
                    previewUrl: t.previewUrl,
                    bpm: t.bpm,
                    position: position++,
                    playlist: { id: event.playlist.id } as any,
                }),
            );

        if (rows.length) await this.tracks.save(rows);
        return { added: rows.length };
    }

    /**
     * Un voter peut voter pour plusieurs morceaux, mais une seule fois chacun :
     * contrainte unique (event, voter, track) en base. INSERT ... ON CONFLICT
     * DO NOTHING est une seule instruction SQL atomique, donc deux votes
     * concurrents du meme utilisateur pour le meme morceau ne peuvent ni
     * dupliquer de ligne ni se marcher dessus.
     */
    async castVote(eventId: number, voterId: number, trackId: number): Promise<void> {
        const belongs = await this.trackBelongsToEvent(eventId, trackId);
        if (!belongs) throw new NotFoundException('Track not found in this event');

        // Les proprietes de relation s'appellent event/voter/track (pas
        // eventId/voterId/trackId) : la query builder insert() les mappe vers
        // les FK reelles seulement si on passe l'id sous le nom de la relation.
        await this.votes
            .createQueryBuilder()
            .insert()
            .into(Vote)
            .values({ event: eventId, voter: voterId, track: trackId } as any)
            .orIgnore()
            .execute();
    }

    async retractVote(eventId: number, voterId: number, trackId: number): Promise<void> {
        await this.votes.delete({ event: { id: eventId }, voter: { id: voterId }, track: { id: trackId } });
    }

    /** Board pour un utilisateur precis (inclut ses propres votes, un par morceau). */
    async getBoard(eventId: number, userId: number): Promise<Board> {
        const board = await this.getPublicBoard(eventId);
        const myVotes = await this.votes.find({
            where: { event: { id: eventId }, voter: { id: userId } },
            relations: { track: true },
        });
        const myVotedTrackIds = new Set(myVotes.map((v) => v.track.id));
        return {
            ...board,
            tracks: board.tracks.map((t) => ({ ...t, myVote: myVotedTrackIds.has(t.trackId) })),
        };
    }

    /** Board diffuse a toute la room (pas de notion de "mon vote" cote broadcast). */
    async getPublicBoard(eventId: number): Promise<Board> {
        await this.ensureAdvanced(eventId);

        const event = await this.eventService.findOne(eventId);
        const tracks = await this.tracks.find({
            where: { playlist: { id: event.playlist.id }, playedAt: IsNull() },
        });
        const countByTrack = await this.voteCounts(eventId);

        const board = tracks
            .map((t) => ({
                trackId: t.id,
                deezerId: t.deezerId,
                title: t.title,
                artist: t.artist,
                cover: t.cover,
                voteCount: countByTrack.get(t.id) ?? 0,
                myVote: false,
                position: t.position,
            }))
            .sort((a, b) => b.voteCount - a.voteCount || a.position - b.position)
            .map(({ position, ...rest }) => rest);

        const nowPlaying = await this.buildNowPlaying(eventId, tracks);

        return { tracks: board, nowPlaying, updatedAt: Date.now() };
    }

    /**
     * Fait avancer la file si le morceau en cours a depasse sa duree.
     * Le passage "joue" est un UPDATE conditionnel atomique (playedAt IS NULL
     * -> playedAt = now) : si deux appels concurrents (deux clients qui
     * rafraichissent en meme temps) tombent ici ensemble, un seul "gagne" la
     * ligne et choisit le morceau suivant, l'autre voit affected=0 et
     * s'arrete sans dupliquer l'avancee ni relancer un choix different.
     */
    private async ensureAdvanced(eventId: number): Promise<void> {
        const state = await this.getNowPlayingState(eventId);
        const now = Date.now();
        if (state && now - state.startedAt < PREVIEW_DURATION_MS) return;

        if (state) {
            const result = await this.tracks.update({ id: state.trackId, playedAt: IsNull() }, { playedAt: new Date() });
            if (!result.affected) return;
        }

        const next = await this.pickNextTrack(eventId);
        if (!next) {
            await this.cache.del(this.nowPlayingKey(eventId));
            return;
        }
        await this.cache.set(this.nowPlayingKey(eventId), { trackId: next.id, startedAt: now }, PREVIEW_DURATION_MS + 5_000);
    }

    private async pickNextTrack(eventId: number): Promise<PlaylistTrack | null> {
        const event = await this.eventService.findOne(eventId);
        const candidates = await this.tracks.find({
            where: { playlist: { id: event.playlist.id }, playedAt: IsNull() },
        });
        if (candidates.length === 0) return null;

        const counts = await this.voteCounts(eventId);
        return candidates
            .slice()
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.position - b.position)[0];
    }

    private async voteCounts(eventId: number): Promise<Map<number, number>> {
        const counts = await this.votes
            .createQueryBuilder('vote')
            .select('vote.trackId', 'trackId')
            .addSelect('COUNT(*)', 'voteCount')
            .where('vote.eventId = :eventId', { eventId })
            .groupBy('vote.trackId')
            .getRawMany<{ trackId: number; voteCount: string }>();
        return new Map(counts.map((c) => [c.trackId, parseInt(c.voteCount, 10)]));
    }

    private nowPlayingKey(eventId: number): string {
        return `trackvote:nowplaying:${eventId}`;
    }

    private async getNowPlayingState(eventId: number): Promise<NowPlayingState | null> {
        return (await this.cache.get<NowPlayingState>(this.nowPlayingKey(eventId))) ?? null;
    }

    private async buildNowPlaying(eventId: number, loadedTracks: PlaylistTrack[]): Promise<NowPlaying | null> {
        const state = await this.getNowPlayingState(eventId);
        if (!state) return null;
        const track =
            loadedTracks.find((t) => t.id === state.trackId) ??
            (await this.tracks.findOne({ where: { id: state.trackId } }));
        if (!track) return null;
        return {
            trackId: track.id,
            deezerId: track.deezerId,
            title: track.title,
            artist: track.artist,
            cover: track.cover,
            previewUrl: track.previewUrl,
            startedAt: state.startedAt,
            durationMs: PREVIEW_DURATION_MS,
        };
    }

    private async trackBelongsToEvent(eventId: number, trackId: number): Promise<boolean> {
        const event = await this.eventService.findOne(eventId);
        const track = await this.tracks.findOne({
            where: { id: trackId, playlist: { id: event.playlist.id }, playedAt: IsNull() },
        });
        return !!track;
    }
}
