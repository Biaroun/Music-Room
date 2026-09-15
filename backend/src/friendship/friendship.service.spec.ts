// TL;DR test the sent pending requests and cancel request in the friendship service
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { Friendship, FriendshipStatus } from './friendship.entity';

describe('FriendshipService', () => {
  let service: FriendshipService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendshipService,
        { provide: getRepositoryToken(Friendship), useValue: repo },
      ],
    }).compile();

    service = module.get<FriendshipService>(FriendshipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSentPendingRequests', () => {
    it('returns pending requests sent by the requester', async () => {
      const pending = [{ id: 1, status: FriendshipStatus.PENDING }] as Friendship[];
      repo.find.mockResolvedValue(pending);

      const result = await service.getSentPendingRequests(42);

      expect(repo.find).toHaveBeenCalledWith({
        where: { requester: { id: 42 }, status: FriendshipStatus.PENDING },
        relations: ['requester', 'receiver'],
      });
      expect(result).toBe(pending);
    });
  });

  describe('cancelSentRequest', () => {
    it('deletes the pending request when the caller is the requester', async () => {
      const relation = { id: 7 } as Friendship;
      repo.findOne.mockResolvedValue(relation);

      await service.cancelSentRequest(7, 42);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 7, requester: { id: 42 }, status: FriendshipStatus.PENDING },
        relations: ['requester', 'receiver'],
      });
      expect(repo.delete).toHaveBeenCalledWith(7);
    });

    it('throws NotFoundException when no matching pending request exists', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.cancelSentRequest(7, 42)).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
