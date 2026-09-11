import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let mail: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    users = {
      isAlreadyExist: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue({ id: 7, username: 'bob', email: 'bob@test.local' }),
      generateEmailVerificationToken: jest.fn().mockResolvedValue('verif-token'),
      generatePasswordResetToken: jest.fn().mockResolvedValue('reset-token'),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByGoogleId: jest.fn(),
      attachGoogle: jest.fn().mockResolvedValue(undefined),
      detachGoogle: jest.fn().mockResolvedValue(undefined),
      availableUsername: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    mail = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: { sign: () => 'jwt' } },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // le smtp de dev (mailtrap) rate-limit : un mail perdu ne doit pas faire
  // echouer une action qui a deja reussi en base
  describe('quand le smtp echoue', () => {
    beforeEach(() => {
      mail.sendVerificationEmail.mockRejectedValue(new Error('550 Too many emails per second'));
      mail.sendPasswordResetEmail.mockRejectedValue(new Error('550 Too many emails per second'));
    });

    it('register renvoie quand meme le token du compte cree', async () => {
      const res = await service.register({
        username: 'bob', email: 'bob@test.local', password: 'Motdepasse12!', passwordConfirm: 'Motdepasse12!',
      });
      expect(res).toEqual({ access_token: 'jwt' });
      expect(users.create).toHaveBeenCalled();
    });

    it('forgot-password garde sa reponse neutre', async () => {
      users.findByEmail.mockResolvedValue({ id: 7, email: 'bob@test.local' });
      await expect(service.forgot_password('bob@test.local')).resolves.toEqual({
        message: 'If this email exists, a reset link has been sent',
      });
    });

    it('le renvoi du mail de verification previent l\'utilisateur', async () => {
      users.findById.mockResolvedValue({ id: 7, email: 'bob@test.local', emailisVerified: false });
      await expect(service.resendVerification(7)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('login', () => {
    // un compte cree par google n'a pas de mot de passe : bcrypt leverait une
    // erreur (500) au lieu d'un simple refus
    it('refuse proprement un compte sans mot de passe', async () => {
      users.findByEmail.mockResolvedValue({ id: 7, email: 'bob@gmail.com', password: null });
      await expect(service.login({ login: 'bob@gmail.com', password: 'Motdepasse12!' }))
        .rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('google', () => {
    const identity = { googleId: 'g-123', email: 'bob@gmail.com', username: 'Bob Martin' };

    it('retrouve un compte deja lie par son id google', async () => {
      users.findByGoogleId.mockResolvedValue({ id: 7, username: 'bob' });

      await expect(service.handleGoogleUser(identity)).resolves.toEqual({ access_token: 'jwt' });
      expect(users.create).not.toHaveBeenCalled();
      expect(users.attachGoogle).not.toHaveBeenCalled();
    });

    it('lie automatiquement un compte qui a la meme adresse', async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue({ id: 7, username: 'bob', email: 'bob@gmail.com' });

      await service.handleGoogleUser(identity);

      expect(users.attachGoogle).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), identity);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('cree un compte avec un username libre sinon', async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      users.availableUsername.mockResolvedValue('Bob_Martin');

      await service.handleGoogleUser(identity);

      expect(users.availableUsername).toHaveBeenCalledWith('Bob Martin');
      expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'Bob_Martin', googleId: 'g-123', googleEmail: 'bob@gmail.com', emailisVerified: true,
      }));
    });

    describe('liaison depuis un compte existant', () => {
      it('le ticket porte l\'id du user et expire', async () => {
        const { ticket } = await service.createGoogleLinkTicket(7);

        expect(ticket).toMatch(/^[a-f0-9]{48}$/);
        expect(cache.set).toHaveBeenCalledWith(`google-link:${ticket}`, 7, expect.any(Number));
      });

      it('refuse un ticket inconnu ou expire', async () => {
        cache.get.mockResolvedValue(undefined);
        await expect(service.linkGoogle('nope', identity)).rejects.toBeInstanceOf(BadRequestException);
        expect(users.attachGoogle).not.toHaveBeenCalled();
      });

      it('refuse un compte google deja lie a quelqu\'un d\'autre', async () => {
        cache.get.mockResolvedValue(7);
        users.findByGoogleId.mockResolvedValue({ id: 99 });

        await expect(service.linkGoogle('t', identity)).rejects.toBeInstanceOf(ConflictException);
        expect(users.attachGoogle).not.toHaveBeenCalled();
      });

      it('lie le compte google et consomme le ticket', async () => {
        cache.get.mockResolvedValue(7);
        users.findByGoogleId.mockResolvedValue(null);
        users.findById.mockResolvedValue({ id: 7, email: 'bob@test.local' });

        await service.linkGoogle('t', identity);

        expect(cache.del).toHaveBeenCalledWith('google-link:t');
        expect(users.attachGoogle).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), identity);
      });
    });

    describe('unlinkGoogle', () => {
      it('refuse de couper le seul moyen de connexion', async () => {
        users.findById.mockResolvedValue({ id: 7, password: null, googleEmail: 'bob@gmail.com' });
        await expect(service.unlinkGoogle(7)).rejects.toBeInstanceOf(BadRequestException);
        expect(users.detachGoogle).not.toHaveBeenCalled();
      });

      it('delie un compte qui a un mot de passe', async () => {
        users.findById.mockResolvedValue({ id: 7, password: 'hash', googleEmail: 'bob@gmail.com' });
        await service.unlinkGoogle(7);
        expect(users.detachGoogle).toHaveBeenCalledWith(7);
      });
    });
  });

  describe('resendVerification', () => {
    it('envoie un nouveau lien a un compte non verifie', async () => {
      users.findById.mockResolvedValue({ id: 7, email: 'bob@test.local', emailisVerified: false });

      await service.resendVerification(7);

      expect(users.generateEmailVerificationToken).toHaveBeenCalledWith(7);
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith('bob@test.local', 'verif-token');
    });

    it('refuse si l\'email est deja verifie', async () => {
      users.findById.mockResolvedValue({ id: 7, email: 'bob@test.local', emailisVerified: true });

      await expect(service.resendVerification(7)).rejects.toBeInstanceOf(BadRequestException);
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
