import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PREVIEW_DURATION_MS, TrackVoteService } from './track-vote.service';
import { Vote } from './vote.entity';
import { PlaylistTrack } from '../playlist-editor/playlist-track.entity';
import { Playlist } from '../playlist-editor/playlist.entity';
import { EventService } from './event.service';

describe('TrackVoteService', () => {
  let service: TrackVoteService;
  let votes: {
    find: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let tracks: {
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let eventService: { findOne: jest.Mock };
  let playlists: { findOne: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let insertQb: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };

  beforeEach(async () => {
    insertQb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    votes = {
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => insertQb),
    };
    tracks = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    eventService = { findOne: jest.fn() };
    playlists = { findOne: jest.fn() };
    // Petit cache en memoire (pas juste un mock statique) : ensureAdvanced
    // fait un cache.set puis buildNowPlaying refait un cache.get juste apres,
    // il faut donc que la valeur ecrite soit relue, comme un vrai cache.
    const store = new Map<string, unknown>();
    cache = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key))),
      set: jest.fn((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackVoteService,
        { provide: getRepositoryToken(Vote), useValue: votes },
        { provide: getRepositoryToken(PlaylistTrack), useValue: tracks },
        { provide: getRepositoryToken(Playlist), useValue: playlists },
        { provide: EventService, useValue: eventService },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<TrackVoteService>(TrackVoteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('castVote', () => {
    it('upserts on the (event, voter, track) conflict target, ignoring a duplicate vote for the same track', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.findOne.mockResolvedValue({ id: 42 });

      await service.castVote(10, 1, 42);

      expect(insertQb.values).toHaveBeenCalledWith({ event: 10, voter: 1, track: 42 });
      expect(insertQb.orIgnore).toHaveBeenCalled();
      expect(insertQb.execute).toHaveBeenCalled();
    });

    it('throws when the track does not belong to the event playlist', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.findOne.mockResolvedValue(null);

      await expect(service.castVote(10, 1, 999)).rejects.toThrow('Track not found in this event');
    });
  });

  describe('importPlaylist', () => {
    it('copies tracks from a playlist I own into the event, skipping ones already there', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      playlists.findOne.mockResolvedValue({
        id: 7,
        owner: { id: 1 },
        tracks: [
          { deezerId: 'a', title: 'A', artist: 'x', artistId: null, cover: null, previewUrl: 'ua', bpm: null },
          { deezerId: 'b', title: 'B', artist: 'x', artistId: null, cover: null, previewUrl: 'ub', bpm: null },
        ],
      });
      tracks.find.mockResolvedValue([{ deezerId: 'a' }]); // deja present dans l'event
      tracks.create.mockImplementation((v) => v);

      const result = await service.importPlaylist(10, 1, 7);

      expect(result).toEqual({ added: 1 });
      expect(tracks.save).toHaveBeenCalledWith([expect.objectContaining({ deezerId: 'b' })]);
    });

    it('rejects importing a playlist that does not belong to the requester', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      playlists.findOne.mockResolvedValue({ id: 7, owner: { id: 99 }, tracks: [] });

      await expect(service.importPlaylist(10, 1, 7)).rejects.toThrow('Not your playlist');
    });

    it('404s when the source playlist does not exist', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      playlists.findOne.mockResolvedValue(null);

      await expect(service.importPlaylist(10, 1, 999)).rejects.toThrow('Playlist not found');
    });
  });

  describe('retractVote', () => {
    it('deletes only the vote for that specific (event, voter, track)', async () => {
      await service.retractVote(10, 1, 42);

      expect(votes.delete).toHaveBeenCalledWith({
        event: { id: 10 },
        voter: { id: 1 },
        track: { id: 42 },
      });
    });
  });

  describe('getBoard', () => {
    it('marks myVote true for every track the user voted for, allowing several votes for the same user', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([
        { id: 1, deezerId: 'a', title: 'A', artist: 'x', cover: null, position: 0 },
        { id: 2, deezerId: 'b', title: 'B', artist: 'x', cover: null, position: 1 },
      ]);
      votes.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      });
      votes.find.mockResolvedValue([{ track: { id: 1 } }, { track: { id: 2 } }]);

      const board = await service.getBoard(10, 1);

      expect(board.tracks.every((t) => t.myVote)).toBe(true);
    });
  });

  describe('getPublicBoard', () => {
    it('sorts tracks by vote count desc, tiebreak by original position asc, and includes zero-vote tracks', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([
        { id: 1, deezerId: 'a', title: 'A', artist: 'x', cover: null, position: 0 },
        { id: 2, deezerId: 'b', title: 'B', artist: 'x', cover: null, position: 1 },
        { id: 3, deezerId: 'c', title: 'C', artist: 'x', cover: null, position: 2 },
      ]);
      const getRawMany = jest
        .fn()
        .mockResolvedValue([
          { trackId: 2, voteCount: '3' },
          { trackId: 1, voteCount: '3' },
        ]);
      votes.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany,
      });

      const board = await service.getPublicBoard(10);

      // track 1 and 2 tie at 3 votes -> tiebreak keeps original position order (1 before 2)
      expect(board.tracks.map((t) => t.trackId)).toEqual([1, 2, 3]);
      expect(board.tracks[2]).toMatchObject({ trackId: 3, voteCount: 0 });
    });
  });

  describe('playback queue (nowPlaying)', () => {
    const emptyVotes = () =>
      votes.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ trackId: 1, voteCount: '2' }]),
      });

    it('auto-starts the top-voted track when nothing is playing yet', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([
        { id: 1, deezerId: 'a', title: 'A', artist: 'x', cover: null, previewUrl: 'u1', position: 0 },
        { id: 2, deezerId: 'b', title: 'B', artist: 'x', cover: null, previewUrl: 'u2', position: 1 },
      ]);
      emptyVotes();
      // store vide au depart : premier get -> undefined, comme un event tout neuf

      const board = await service.getPublicBoard(10);

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('10'),
        expect.objectContaining({ trackId: 1 }),
        expect.any(Number),
      );
      expect(board.nowPlaying).toMatchObject({ trackId: 1, previewUrl: 'u1' });
      expect(tracks.update).not.toHaveBeenCalled();
    });

    it('does not advance while the current track is still within its play duration', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([
        { id: 1, deezerId: 'a', title: 'A', artist: 'x', cover: null, previewUrl: 'u1', position: 0 },
      ]);
      emptyVotes();
      cache.get.mockResolvedValueOnce({ trackId: 1, startedAt: Date.now() - 1000 });

      await service.getPublicBoard(10);

      expect(tracks.update).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('marks the finished track as played (conditional update) and picks the next one when time is up', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([
        { id: 2, deezerId: 'b', title: 'B', artist: 'x', cover: null, previewUrl: 'u2', position: 1 },
      ]);
      emptyVotes();
      // seul le premier get (dans ensureAdvanced) doit voir l'etat perime ;
      // le second (dans buildNowPlaying) doit relire ce qu'ensureAdvanced vient d'ecrire
      cache.get.mockResolvedValueOnce({ trackId: 1, startedAt: Date.now() - (PREVIEW_DURATION_MS + 1000) });

      const board = await service.getPublicBoard(10);

      expect(tracks.update).toHaveBeenCalledWith(
        { id: 1, playedAt: expect.anything() },
        { playedAt: expect.any(Date) },
      );
      expect(board.nowPlaying).toMatchObject({ trackId: 2 });
    });

    it('does not double-advance when the conditional update finds the track already marked played (concurrent call)', async () => {
      eventService.findOne.mockResolvedValue({ playlist: { id: 5 } });
      tracks.find.mockResolvedValue([]);
      emptyVotes();
      cache.get.mockResolvedValue({ trackId: 1, startedAt: Date.now() - (PREVIEW_DURATION_MS + 1000) });
      tracks.update.mockResolvedValue({ affected: 0 });

      await service.getPublicBoard(10);

      // affected=0 => un autre appel a deja gagne la course : on ne relance pas de choix ici
      expect(cache.set).not.toHaveBeenCalled();
      expect(cache.del).not.toHaveBeenCalled();
    });
  });
});
