import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist } from './playlist.entity';
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
    ({ id: 10, name: 'P', isPublic: true, version: 0, owner: { id: OWNER, username: 'owner' }, ...over }) as Playlist;

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
      playlists.findOne.mockResolvedValue(basePlaylist());

      await expect(service.assertCanEdit(10, OWNER)).resolves.toMatchObject({ id: 10 });
      expect(collaborators.findOne).not.toHaveBeenCalled();
    });

    it('lets an invited collaborator through', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      collaborators.findOne.mockResolvedValue({ id: 99 });

      await expect(service.assertCanEdit(10, COLLABORATOR)).resolves.toMatchObject({ id: 10 });
    });

    it('rejects a stranger', async () => {
      playlists.findOne.mockResolvedValue(basePlaylist());
      collaborators.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, STRANGER)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound when the playlist does not exist', async () => {
      playlists.findOne.mockResolvedValue(null);

      await expect(service.assertCanEdit(10, OWNER)).rejects.toThrow(NotFoundException);
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
});
