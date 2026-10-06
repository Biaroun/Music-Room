// TL;DR test auth service (smtp down dont break login google login link unlink resend mail)
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
import { createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let mail: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let config: Record<string, string>;

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
    config = {};
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
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.restoreAllMocks());

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

    it('lie automatiquement un compte verifie qui a la meme adresse', async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue({ id: 7, username: 'bob', email: 'bob@gmail.com', emailisVerified: true });

      await service.handleGoogleUser(identity);

      expect(users.attachGoogle).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), identity);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('ne rattache pas google a un compte dont l\'adresse n\'est pas verifiee', async () => {
      users.findByGoogleId.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue({ id: 7, email: 'bob@gmail.com', password: 'hash', emailisVerified: false });

      await expect(service.handleGoogleUser(identity)).rejects.toBeInstanceOf(ConflictException);
      expect(users.attachGoogle).not.toHaveBeenCalled();
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

    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    describe('code rendu a l\'app apres google', () => {
      it('garde l\'identite et le challenge sous un code qui expire', async () => {
        const code = await service.createGoogleCode(identity, challenge);

        expect(code).toMatch(/^[a-f0-9]{48}$/);
        expect(cache.set).toHaveBeenCalledWith(`google-code:${code}`, { identity, challenge }, expect.any(Number));
      });

      it('echange le code contre un jwt avec le bon verifier', async () => {
        cache.get.mockResolvedValue({ identity, challenge });
        users.findByGoogleId.mockResolvedValue({ id: 7, username: 'bob' });

        await expect(service.exchangeGoogleCode('c', verifier)).resolves.toEqual({ access_token: 'jwt' });
        expect(cache.del).toHaveBeenCalledWith('google-code:c');
      });

      it('refuse un mauvais verifier et grille le code', async () => {
        cache.get.mockResolvedValue({ identity, challenge });
        const other = createHash('sha256').update('autre').digest('hex');

        await expect(service.exchangeGoogleCode('c', other)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(cache.del).toHaveBeenCalledWith('google-code:c');
        expect(users.findByGoogleId).not.toHaveBeenCalled();
      });

      it('refuse un code inconnu, expire ou deja utilise', async () => {
        cache.get.mockResolvedValue(undefined);
        await expect(service.exchangeGoogleCode('nope', verifier)).rejects.toBeInstanceOf(UnauthorizedException);
      });
    });

    describe('liaison depuis un compte existant', () => {
      it('refuse un code inconnu ou expire', async () => {
        cache.get.mockResolvedValue(undefined);
        await expect(service.linkGoogle(7, 'nope', verifier)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(users.attachGoogle).not.toHaveBeenCalled();
      });

      it('refuse un compte google deja lie a quelqu\'un d\'autre', async () => {
        cache.get.mockResolvedValue({ identity, challenge });
        users.findByGoogleId.mockResolvedValue({ id: 99 });

        await expect(service.linkGoogle(7, 'c', verifier)).rejects.toBeInstanceOf(ConflictException);
        expect(users.attachGoogle).not.toHaveBeenCalled();
      });

      it('lie le compte google au user connecte et consomme le code', async () => {
        cache.get.mockResolvedValue({ identity, challenge });
        users.findByGoogleId.mockResolvedValue(null);
        users.findById.mockResolvedValue({ id: 7, email: 'bob@test.local' });

        await service.linkGoogle(7, 'c', verifier);

        expect(cache.del).toHaveBeenCalledWith('google-code:c');
        expect(users.attachGoogle).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), identity);
      });
    });

    describe('id token', () => {
      it('rend un 401 et pas un 500 pour un token invalide', async () => {
        config.GOOGLE_CLIENT_ID_WEB = 'web-client';
        jest.spyOn(OAuth2Client.prototype as any, 'verifyIdToken').mockRejectedValue(new Error('Wrong number of segments'));

        await expect(service.verifyGoogleToken('pas-un-jwt')).rejects.toBeInstanceOf(UnauthorizedException);
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
