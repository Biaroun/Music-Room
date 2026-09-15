// TL;DR test that the users controller always send the avatar and hide private fields
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FriendshipService } from '../friendship/friendship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { findById: jest.Mock; updateProfile: jest.Mock; searchByUsername: jest.Mock };
  let friendshipService: { areFriends: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
      searchByUsername: jest.fn(),
    };
    friendshipService = { areFriends: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: FriendshipService, useValue: friendshipService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('includes avatar in the response', async () => {
      usersService.findById.mockResolvedValue({ id: 1, username: 'alice', avatar: 'avatar-4' });

      const result = await controller.getMe({ id: 1, username: 'alice' });

      expect(result.avatar).toBe('avatar-4');
    });
  });

  describe('updateMe', () => {
    it('includes avatar in the response', async () => {
      usersService.updateProfile.mockResolvedValue({ id: 1, username: 'alice', avatar: 'avatar-6' });

      const result = await controller.updateMe({ id: 1 }, {} as any);

      expect(result.avatar).toBe('avatar-6');
    });
  });

  describe('searchUsers', () => {
    it('includes avatar for each result', async () => {
      usersService.searchByUsername.mockResolvedValue([{ id: 2, username: 'bob', avatar: 'avatar-2' }]);

      const result = await controller.searchUsers({ id: 1 }, 'bo');

      expect(result).toEqual([{ id: 2, username: 'bob', avatar: 'avatar-2' }]);
    });
  });

  describe('getUserProfile', () => {
    it('always returns avatar, even when other fields are private', async () => {
      usersService.findById.mockResolvedValue({
        id: 2,
        username: 'bob',
        avatar: 'avatar-7',
        bio: 'secret',
        musicpreferences: ['rock'],
        visibilitySettings: { bio: 'private', musicPreferences: 'private' },
      });
      friendshipService.areFriends.mockResolvedValue(false);

      const result = await controller.getUserProfile({ id: 1 }, '2');

      expect(result.avatar).toBe('avatar-7');
      expect(result.bio).toBeNull();
    });
  });
});
