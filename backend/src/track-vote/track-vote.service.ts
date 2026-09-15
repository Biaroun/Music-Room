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

// duree standard d'un extrait deezer, faute de duree exacte stockee par
// morceau : sert de duree de lecture pour la file
export const PREVIEW_DURATION_MS = 30_000;

// one line of the vote board
export type BoardTrack = {
    trackId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    voteCount: number;
    myVote: boolean;
};

// the track playing now in the event (startedAt in ms)
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

// what the clients get (ranked tracks + now playing)
export type Board = {
    tracks: BoardTrack[];
    nowPlaying: NowPlaying | null;
    updatedAt: number;
};

// what we keep in redis for the current track
type NowPlayingState = { trackId: number; startedAt: number };

// vote logic (suggest import vote board and the play queue)
@Injectable()
export class TrackVoteService {
    constructor(
        @InjectRepository(Vote) private votes: Repository<Vote>,
        @InjectRepository(PlaylistTrack) private tracks: Repository<PlaylistTrack>,
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        private eventService: EventService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    // le controle d'acces reste dans EventService : ici on suppose l'appelant
    // l'a deja fait

    // add a suggested track at the end of the event playlist
    async suggestTrack(eventId: number, dto: AddTrackDto): Promise<PlaylistTrack> {
        const event = await this.eventService.findOne(eventId);
        const position = await this.tracks.count({ where: { playlist: { id: event.playlist.id } } });
        const track = this.tracks.create({ ...dto, position, playlist: { id: event.playlist.id } as any });
        return this.tracks.save(track);
    }

    /**
     * copie une de mes playlists dans celle de l'event en une seule ecriture,
     * donc un seul broadcast a la fin plutot qu'un par morceau. les deezerId
     * deja presents ne sont pas dupliques.
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
        // new tracks go after the ones already there
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
     * un voter vote pour plusieurs morceaux mais une seule fois chacun, via la
     * contrainte unique (event, voter, track). insert ... on conflict do
     * nothing tient en une instruction atomique, donc deux votes concurrents
     * ne peuvent ni dupliquer de ligne ni se marcher dessus.
     */
    async castVote(eventId: number, voterId: number, trackId: number): Promise<void> {
        const belongs = await this.trackBelongsToEvent(eventId, trackId);
        if (!belongs) throw new NotFoundException('Track not found in this event');

        // les relations s'appellent event/voter/track et pas eventId/voterId :
        // insert() ne mappe vers les vraies cles que sous ce nom-la
        await this.votes
            .createQueryBuilder()
            .insert()
            .into(Vote)
            .values({ event: eventId, voter: voterId, track: trackId } as any)
            .orIgnore()
            .execute();
    }

    // remove my vote for one track
    async retractVote(eventId: number, voterId: number, trackId: number): Promise<void> {
        await this.votes.delete({ event: { id: eventId }, voter: { id: voterId }, track: { id: trackId } });
    }

    /** board d'un utilisateur precis, avec ses propres votes */
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

    /** board diffuse a la room, sans notion de vote personnel */
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
            // most votes first and egalite = lowest position first
            .sort((a, b) => b.voteCount - a.voteCount || a.position - b.position)
            // on vire position (only used for the sort)
            .map(({ position, ...rest }) => rest);

        const nowPlaying = await this.buildNowPlaying(eventId, tracks);

        return { tracks: board, nowPlaying, updatedAt: Date.now() };
    }

    /**
     * fait avancer la file si le morceau en cours a depasse sa duree.
     * le passage a joue est un update conditionnel atomique sur playedAt : si
     * deux clients rafraichissent en meme temps, un seul gagne la ligne et
     * choisit le suivant, l'autre voit affected=0 et s'arrete.
     */
    private async ensureAdvanced(eventId: number): Promise<void> {
        const state = await this.getNowPlayingState(eventId);
        const now = Date.now();
        // current track not finished yet so nothing to do
        if (state && now - state.startedAt < PREVIEW_DURATION_MS) return;

        if (state) {
            const result = await this.tracks.update({ id: state.trackId, playedAt: IsNull() }, { playedAt: new Date() });
            // affected 0 = another call already moved the queue
            if (!result.affected) return;
        }

        const next = await this.pickNextTrack(eventId);
        if (!next) {
            await this.cache.del(this.nowPlayingKey(eventId));
            return;
        }
        // ttl = track duration + 5s of margin
        await this.cache.set(this.nowPlayingKey(eventId), { trackId: next.id, startedAt: now }, PREVIEW_DURATION_MS + 5_000);
    }

    // the not played track with the most votes (egalite = lowest position)
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

    // count the votes per track in sql (map trackId = count)
    private async voteCounts(eventId: number): Promise<Map<number, number>> {
        const counts = await this.votes
            .createQueryBuilder('vote')
            .select('vote.trackId', 'trackId')
            .addSelect('COUNT(*)', 'voteCount')
            .where('vote.eventId = :eventId', { eventId })
            .groupBy('vote.trackId')
            .getRawMany<{ trackId: number; voteCount: string }>();
        // postgres send COUNT as a string so parseInt
        return new Map(counts.map((c) => [c.trackId, parseInt(c.voteCount, 10)]));
    }

    // redis key of the now playing of an event
    private nowPlayingKey(eventId: number): string {
        return `trackvote:nowplaying:${eventId}`;
    }

    // read the now playing state from redis
    private async getNowPlayingState(eventId: number): Promise<NowPlayingState | null> {
        return (await this.cache.get<NowPlayingState>(this.nowPlayingKey(eventId))) ?? null;
    }

    // build the full now playing (extra query if the track is not in loadedTracks)
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

    // true if the track is in the event playlist and not played yet
    private async trackBelongsToEvent(eventId: number, trackId: number): Promise<boolean> {
        const event = await this.eventService.findOne(eventId);
        const track = await this.tracks.findOne({
            where: { id: trackId, playlist: { id: event.playlist.id }, playedAt: IsNull() },
        });
        return !!track;
    }
}
