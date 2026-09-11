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

  describe('tokens sans valeur', () => {
    // typeorm ignore une condition undefined : findOne({ where: { token: undefined } })
    // renverrait le premier user venu
    it.each([undefined, ''])('verifyEmailToken(%p) ne touche pas la base', async (token) => {
      await expect(service.verifyEmailToken(token as any)).resolves.toBe(false);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it.each([undefined, ''])('isPasswordResetTokenValid(%p) ne touche pas la base', async (token) => {
      await expect(service.isPasswordResetTokenValid(token as any)).resolves.toBe(false);
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('isPasswordResetTokenValid', () => {
    it('accepte un token encore valide', async () => {
      repo.findOne.mockResolvedValue({ id: 1, passwordResetExpires: new Date(Date.now() + 60_000) });
      await expect(service.isPasswordResetTokenValid('abc')).resolves.toBe(true);
    });

    it('refuse un token expire', async () => {
      repo.findOne.mockResolvedValue({ id: 1, passwordResetExpires: new Date(Date.now() - 1) });
      await expect(service.isPasswordResetTokenValid('abc')).resolves.toBe(false);
    });

    it('refuse un token inconnu', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.isPasswordResetTokenValid('abc')).resolves.toBe(false);
    });
  });

  describe('availableUsername', () => {
    // le nom google ("Bob Martin") ne passe pas la regle des usernames et
    // deux homonymes feraient sauter la contrainte unique
    it('nettoie le nom google', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.availableUsername('Élodie Martin-Dupont')).resolves.toBe('Elodie_Martin-Dupont');
    });

    it('ajoute un suffixe si le nom est pris', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 1 }).mockResolvedValue(null);
      await expect(service.availableUsername('Bob')).resolves.toMatch(/^Bob_\d{4}$/);
    });

    it('retombe sur "user" si rien n\'est gardable', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.availableUsername('李小龙')).resolves.toBe('user');
    });
  });

  describe('attachGoogle', () => {
    const identity = { googleId: 'g-1', email: 'Bob@Gmail.com', username: 'Bob' };

    it('valide l\'email quand google prouve la meme adresse', async () => {
      await service.attachGoogle({ id: 1, email: 'bob@gmail.com' } as any, identity);
      expect(repo.update).toHaveBeenCalledWith(1, {
        googleId: 'g-1', googleEmail: 'Bob@Gmail.com', emailisVerified: true,
      });
    });

    it('ne touche pas a la validation pour une autre adresse', async () => {
      await service.attachGoogle({ id: 1, email: 'bob@test.local' } as any, identity);
      expect(repo.update).toHaveBeenCalledWith(1, { googleId: 'g-1', googleEmail: 'Bob@Gmail.com' });
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
