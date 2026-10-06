// TL;DR test playlist rights (view edit license) reorder version bumps state findMine editors
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Not } from 'typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist, PlaylistLicenseMode } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';

const OWNER = 1;
const COLLABORATOR = 2;
const STRANGER = 3;

describe('PlaylistEditorService', () => {
  let service: PlaylistEditorService;
  let playlists: {
    findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock;
    remove: jest.Mock; increment: jest.Mock; manager: { transaction: jest.Mock };
  };
  let tracks: {
    findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock;
    remove: jest.Mock; count: jest.Mock; update: jest.Mock;
  };
  let collaborators: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let users: { findOne: jest.Mock };

  const basePlaylist = (over: Partial<Playlist> = {}) =>
    ({
      id: 10, name: 'P', isPublic: true, version: 0,
      licenseMode: PlaylistLicenseMode.OPEN,
      owner: { id: OWNER, username: 'owner' },
      ...over,
    }) as Playlist;

  const restricted = (over: Partial<Playlist> = {}) =>
    basePlaylist({ licenseMode: PlaylistLicenseMode.INVITE_ONLY, ...over });

  beforeEach(async () => {
    playlists = {
      findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(),
      remove: jest.fn(), increment: jest.fn(), manager: { transaction: jest.fn() },
    };
    tracks = {
      findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(),
      remove: jest.fn(), count: jest.fn(), update: jest.fn(),
    };
    collaborators = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() };
    users = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistEditorService,
        { provide: getRepositoryToken(Playlist), useValue: playlists },
        { provide: getRepositoryToken(PlaylistTrack), useValue: tracks },
        { provide: getRepositoryToken(PlaylistCollaborator), useValue: collaborators },
        { provide: getRepositoryToken(User), useValue: users },
      ],
    }).compile();

    service = module.get<PlaylistEditorService>(PlaylistEditorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertCanEdit', () => {
    it('lets the owner through without looking up collaborators', async () => {
      playlists.findOne.mockResolvedValue(restricted());

      await expect(service.assertCanEdit(10, OWNER)).resolves.toMatchObject({ id: 10 });
      expect(collaborators.findOne).not.toHaveBeenCalled();
    });

    it('lets an invited collaborator through when the license is invite-only', async () => {
      playlists.findOne.mockResolvedValue(restricted());
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanEdit(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });

    it('rejects a stranger when the license is invite-only', async () => {
      playlists.findOne.mockResolvedValue(restricted());
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the playlist does not exist', async () => {
      playlists.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, OWNER)).rejects.toThrow(NotFoundException);
    });

    // sujet v.2.3 : par defaut tout le monde peut editer la playlist
    it('lets any viewer edit a public playlist under the default open license', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: true }));

      await expect(service.assertCanEdit(10, STRANGER)).resolves.toMatchObject({ id: 10 });
      expect(collaborators.findOne).not.toHaveBeenCalled();
    });

    // les deux axes se composent : une licence ouverte ne contourne pas la
    // visibilite, on n'edite pas ce qu'on n'a pas le droit de voir
    it('still rejects a stranger on a private playlist even under the open license', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });

    it('lets an invited collaborator edit a private playlist under the open license', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanEdit(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });
  });

  describe('assertCanView', () => {
    it('lets anyone view a public playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: true }));

      await expect(service.assertCanView(10, STRANGER)).resolves.toMatchObject({ id: 10 });
    });

    it('lets a collaborator view a private playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanView(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });

    it('rejects a stranger on a private playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ isPublic: false }));
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanView(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reorder', () => {
    // la vraie methode passe par manager.transaction : le callback est execute
    // avec un EntityManager mocke, pour tester la logique sans base
    function runTransactionWith(em: any) {
      playlists.manager.transaction.mockImplementation((cb: any) => cb(em));
    }

    function entityManager(over: Record<string, unknown> = {}) {
      return {
        findOne: jest.fn().mockResolvedValue(basePlaylist({ version: 7 })),
        find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        update: jest.fn(),
        increment: jest.fn(),
        ...over,
      };
    }

    it('rejects a reorder whose version is stale', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = entityManager();
      runTransactionWith(em);

      await expect(service.reorder(10, OWNER, [2, 1], 5)).rejects.toThrow(ConflictException);
      expect(em.update).not.toHaveBeenCalled();
    });

    it('applies the new order and bumps the version when the version matches', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = entityManager();
      runTransactionWith(em);
      jest.spyOn(service, 'getState').mockResolvedValue({ id: 10, version: 8 } as any);

      await service.reorder(10, OWNER, [2, 1], 7);

      expect(em.update).toHaveBeenCalledWith(PlaylistTrack, 2, { position: 0 });
      expect(em.update).toHaveBeenCalledWith(PlaylistTrack, 1, { position: 1 });
      expect(em.increment).toHaveBeenCalledWith(Playlist, { id: 10 }, 'version', 1);
    });

    it('still applies when no version is supplied (REST backward compatibility)', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = entityManager();
      runTransactionWith(em);
      jest.spyOn(service, 'getState').mockResolvedValue({ id: 10 } as any);

      await service.reorder(10, OWNER, [2, 1]);

      expect(em.update).toHaveBeenCalledTimes(2);
    });

    it('still rejects a track set that does not match the playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist({ version: 7 }));
      const em = entityManager({ find: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]) });
      runTransactionWith(em);

      await expect(service.reorder(10, OWNER, [2, 1], 7)).rejects.toThrow(ForbiddenException);
      expect(em.update).not.toHaveBeenCalled();
    });
  });

  describe('version bumps', () => {
    it('bumps the version when a track is added', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.count.mockResolvedValue(2);
      tracks.create.mockReturnValue({ id: 5 });
      tracks.save.mockResolvedValue({ id: 5, position: 2 });

      await service.addTrack(10, OWNER, { deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u' } as any);

      expect(playlists.increment).toHaveBeenCalledWith({ id: 10 }, 'version', 1);
    });

    it('refuses a track already present in the playlist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.findOne.mockResolvedValue({ id: 7, deezerId: 'dup' });

      await expect(
        service.addTrack(10, OWNER, { deezerId: 'dup', title: 't', artist: 'a', previewUrl: 'u' } as any),
      ).rejects.toThrow(ConflictException);
      expect(tracks.save).not.toHaveBeenCalled();
      expect(playlists.increment).not.toHaveBeenCalled();
    });

    it('looks the duplicate up scoped to this playlist, not globally', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.findOne.mockResolvedValue(null);
      tracks.count.mockResolvedValue(0);
      tracks.create.mockReturnValue({ id: 5 });
      tracks.save.mockResolvedValue({ id: 5 });

      await service.addTrack(10, OWNER, { deezerId: 'dz', title: 't', artist: 'a', previewUrl: 'u' } as any);

      expect(tracks.findOne).toHaveBeenCalledWith({
        where: { playlist: { id: 10 }, deezerId: 'dz' },
      });
    });

    it('bumps the version when a track is removed', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      tracks.findOne.mockResolvedValue({ id: 5 });

      await service.removeTrack(10, 5, OWNER);

      expect(playlists.increment).toHaveBeenCalledWith({ id: 10 }, 'version', 1);
    });
  });

  describe('getState', () => {
    it('returns tracks sorted by position with the version and collaborators', async () => {
      playlists.findOne.mockResolvedValue(
        basePlaylist({ version: 3, tracks: [{ id: 2, position: 1 }, { id: 1, position: 0 }] as any }),
      );
      collaborators.find.mockResolvedValue([
        { collaborator: { id: COLLABORATOR, username: 'bob', avatar: 'a.png' } },
      ]);

      const state = await service.getState(10);

      expect(state.version).toBe(3);
      expect(state.tracks.map((t) => t.id)).toEqual([1, 2]);
      expect(state.collaborators).toEqual([{ id: COLLABORATOR, username: 'bob', avatar: 'a.png' }]);
      expect(state.owner).toEqual({ id: OWNER, username: 'owner' });
    });
  });

  describe('findMine', () => {
    it('returns owned, then shared, then public playlists of other users, flagged with isOwner', async () => {
      playlists.find
        .mockResolvedValueOnce([basePlaylist({ id: 10 })])
        .mockResolvedValueOnce([basePlaylist({ id: 20, owner: { id: 42, username: 'someoneElse' } as any })])
        .mockResolvedValueOnce([basePlaylist({ id: 30, owner: { id: STRANGER, username: 'stranger' } as any })]);
      collaborators.find.mockResolvedValue([{ playlist: { id: 20 } }]);

      const rows = await service.findMine(OWNER);

      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ id: 10, isOwner: true });
      expect(rows[1]).toMatchObject({ id: 20, isOwner: false });
      expect(rows[2]).toMatchObject({ id: 30, isOwner: false });
    });

    it('lists only public playlists of other users, skipping the shared ones', async () => {
      playlists.find.mockResolvedValue([]);
      collaborators.find.mockResolvedValue([{ playlist: { id: 20 } }]);

      await service.findMine(OWNER);

      expect(playlists.find).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { isPublic: true, owner: { id: Not(OWNER) }, id: Not(In([20])) },
        }),
      );
    });

    it('skips the shared query when I collaborate on none', async () => {
      playlists.find
        .mockResolvedValueOnce([basePlaylist({ id: 10 })])
        .mockResolvedValueOnce([]);
      collaborators.find.mockResolvedValue([]);

      const rows = await service.findMine(OWNER);

      expect(rows).toEqual([expect.objectContaining({ id: 10, isOwner: true })]);
      expect(playlists.find).toHaveBeenCalledTimes(2);
      expect(playlists.find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { isPublic: true, owner: { id: Not(OWNER) } } }),
      );
    });
  });

  describe('collaborators', () => {
    it('refuses to add a collaborator when the requester is not the owner', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.addCollaborator(10, STRANGER, COLLABORATOR)).rejects.toThrow(ForbiddenException);
    });

    it('refuses to add a user that does not exist', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      users.findOne.mockResolvedValue(null);

      await expect(service.addCollaborator(10, OWNER, 404)).rejects.toThrow(NotFoundException);
    });

    it('is idempotent when the collaborator is already invited', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      users.findOne.mockResolvedValue({ id: COLLABORATOR });
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.addCollaborator(10, OWNER, COLLABORATOR)).resolves.toMatchObject({ id: 99 });
      expect(collaborators.save).not.toHaveBeenCalled();
    });

    it('refuses to add the owner as their own collaborator', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.addCollaborator(10, OWNER, OWNER)).rejects.toThrow(BadRequestException);
    });
  });
});
