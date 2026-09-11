import { Test, TestingModule } from '@nestjs/testing';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('FriendshipController', () => {
  let controller: FriendshipController;
  let friendshipService: {
    getFriends: jest.Mock;
    getSentPendingRequests: jest.Mock;
    cancelSentRequest: jest.Mock;
    getBlocks: jest.Mock;
  };

  beforeEach(async () => {
    friendshipService = {
      getFriends: jest.fn(),
      getSentPendingRequests: jest.fn(),
      cancelSentRequest: jest.fn(),
      getBlocks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendshipController],
      providers: [{ provide: FriendshipService, useValue: friendshipService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FriendshipController>(FriendshipController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFriends', () => {
    it('includes each friend avatar in the response', async () => {
      friendshipService.getFriends.mockResolvedValue([
        {
          id: 10,
          requester: { id: 1, username: 'alice' },
          receiver: { id: 2, username: 'bob', avatar: 'avatar-2' },
        },
      ]);

      const result = await controller.getFriends({ id: 1 });

      expect(result).toEqual([{ id: 10, friendId: 2, username: 'bob', avatar: 'avatar-2' }]);
    });
  });

  describe('getSentPendingRequests', () => {
    it('maps sent pending requests to id/to/toId/createdAt', async () => {
      const createdAt = new Date('2026-08-01T00:00:00Z');
      friendshipService.getSentPendingRequests.mockResolvedValue([
        { id: 3, receiver: { id: 9, username: 'bob' }, createdAt },
      ]);

      const result = await controller.getSentPendingRequests({ id: 1 });

      expect(friendshipService.getSentPendingRequests).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 3, to: 'bob', toId: 9, createdAt }]);
    });
  });

  describe('cancelSentRequest', () => {
    it('cancels the request and returns a confirmation message', async () => {
      friendshipService.cancelSentRequest.mockResolvedValue(undefined);

      const result = await controller.cancelSentRequest({ id: 1 }, '3');

      expect(friendshipService.cancelSentRequest).toHaveBeenCalledWith(3, 1);
      expect(result).toEqual({ message: 'Friend request cancelled' });
    });
  });

  describe('getBlocks', () => {
    it('includes blockedById and blockedUserId in each entry', async () => {
      friendshipService.getBlocks.mockResolvedValue([
        { id: 5, requester: { id: 1, username: 'me' }, receiver: { id: 2, username: 'them' } },
      ]);

      const result = await controller.getBlocks({ id: 1 });

      expect(result).toEqual([
        { id: 5, blockedBy: 'me', blockedById: 1, blockedUser: 'them', blockedUserId: 2, isBlockedByMe: true },
      ]);
    });
  });
});
