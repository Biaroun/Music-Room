import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { MailService } from '../mail/mail.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: MailService, useValue: { sendVerificationEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('selects the avatar column', async () => {
      repo.findOne.mockResolvedValue({ id: 1, avatar: 'avatar-2' });

      await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ avatar: true }),
        }),
      );
    });
  });

  describe('updateProfile', () => {
    it('sets avatar from the dto', async () => {
      const user: any = { id: 1, avatar: null };
      repo.findOne.mockResolvedValue(user);
      repo.save.mockImplementation(async (u: any) => u);

      const result = await service.updateProfile(1, { avatar: 'avatar-3' } as any);

      expect(result?.avatar).toBe('avatar-3');
    });

    it('clears avatar when the dto sends an empty string', async () => {
      const user: any = { id: 1, avatar: 'avatar-3' };
      repo.findOne.mockResolvedValue(user);
      repo.save.mockImplementation(async (u: any) => u);

      const result = await service.updateProfile(1, { avatar: '' } as any);

      expect(result?.avatar).toBeNull();
    });

    it('leaves avatar untouched when the dto omits it', async () => {
      const user: any = { id: 1, avatar: 'avatar-5' };
      repo.findOne.mockResolvedValue(user);
      repo.save.mockImplementation(async (u: any) => u);

      const result = await service.updateProfile(1, { bio: 'hello' } as any);

      expect(result?.avatar).toBe('avatar-5');
    });
  });

  describe('searchByUsername', () => {
    it('includes avatar in the selected columns', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.searchByUsername('', 1);

      expect(qb.select).toHaveBeenCalledWith(['user.id', 'user.username', 'user.avatar']);
    });
  });
});
