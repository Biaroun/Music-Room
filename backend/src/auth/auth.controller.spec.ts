// TL;DR test the html reset password page and form (valid expired XSS escape dto rules)
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { encodeFlowState } from './google-flow';

// faux Response express : on garde le statut et le html envoyes
function fakeRes() {
  const res: any = { statusCode: 200, body: '' };
  res.status = jest.fn((code: number) => { res.statusCode = code; return res; });
  res.type = jest.fn(() => res);
  res.send = jest.fn((body: string) => { res.body = body; return res; });
  res.redirect = jest.fn();
  return res;
}

const GOOD_PASSWORD = 'Motdepasse12!';

describe('AuthController', () => {
  let controller: AuthController;
  let users: { isPasswordResetTokenValid: jest.Mock; verifyPasswordResetToken: jest.Mock };
  let auth: { createGoogleCode: jest.Mock };

  beforeEach(async () => {
    users = {
      isPasswordResetTokenValid: jest.fn(),
      verifyPasswordResetToken: jest.fn(),
    };

    auth = { createGoogleCode: jest.fn().mockResolvedValue('c0de') };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UsersService, useValue: users },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'OAUTH_APP_REDIRECT' ? 'exp://' : undefined) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /auth/reset-password (page du lien mail)', () => {
    it('affiche le formulaire avec le token si le lien est valide', async () => {
      users.isPasswordResetTokenValid.mockResolvedValue(true);
      const res = fakeRes();

      await controller.resetPasswordPage('abc123', res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<form');
      expect(res.body).toContain('value="abc123"');
    });

    it('affiche une erreur sans formulaire si le lien est expire', async () => {
      users.isPasswordResetTokenValid.mockResolvedValue(false);
      const res = fakeRes();

      await controller.resetPasswordPage('abc123', res);

      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('<form');
      expect(res.body).toContain('expiré');
    });

    it('echappe le token avant de le remettre dans la page', async () => {
      users.isPasswordResetTokenValid.mockResolvedValue(true);
      const res = fakeRes();

      await controller.resetPasswordPage('"><script>alert(1)</script>', res);

      expect(res.body).not.toContain('<script>');
    });
  });

  describe('POST /auth/reset-password/form', () => {
    it('change le mot de passe quand tout est valide', async () => {
      users.verifyPasswordResetToken.mockResolvedValue(true);
      const res = fakeRes();

      await controller.resetPasswordForm(
        { token: 'abc', newPassword: GOOD_PASSWORD, passwordConfirm: GOOD_PASSWORD },
        res,
      );

      expect(users.verifyPasswordResetToken).toHaveBeenCalledWith('abc', GOOD_PASSWORD);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('Mot de passe changé');
    });

    it('reaffiche le formulaire si la confirmation ne correspond pas', async () => {
      const res = fakeRes();

      await controller.resetPasswordForm(
        { token: 'abc', newPassword: GOOD_PASSWORD, passwordConfirm: 'autre' },
        res,
      );

      expect(users.verifyPasswordResetToken).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('<form');
      expect(res.body).toContain('ne correspondent pas');
    });

    it('applique les regles du dto au mot de passe', async () => {
      const res = fakeRes();

      await controller.resetPasswordForm(
        { token: 'abc', newPassword: 'court', passwordConfirm: 'court' },
        res,
      );

      expect(users.verifyPasswordResetToken).not.toHaveBeenCalled();
      expect(res.body).toContain('12 caractères');
    });

    it('signale un lien expire entre l\'affichage et l\'envoi', async () => {
      users.verifyPasswordResetToken.mockResolvedValue(false);
      const res = fakeRes();

      await controller.resetPasswordForm(
        { token: 'abc', newPassword: GOOD_PASSWORD, passwordConfirm: GOOD_PASSWORD },
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('expiré');
    });
  });

  describe('GET /auth/google/web/callback', () => {
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const redirect = 'exp://10.0.2.2:8081/--/auth';
    const state = encodeFlowState({ redirect, challenge });

    it('renvoie l\'app avec un code, jamais le jwt', async () => {
      const identity = { googleId: 'g', email: 'bob@gmail.com', username: 'bob' };
      const res = fakeRes();

      await controller.googleCallback({ user: identity }, state, res);

      expect(auth.createGoogleCode).toHaveBeenCalledWith(identity, challenge);
      expect(res.redirect).toHaveBeenCalledWith(`${redirect}#code=c0de`);
    });

    it('renvoie l\'app avec l\'erreur si google a echoue', async () => {
      const res = fakeRes();

      await controller.googleCallback({ user: null, googleError: 'Google sign-in was cancelled' }, state, res);

      expect(auth.createGoogleCode).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(`${redirect}#error=Google%20sign-in%20was%20cancelled`);
    });

    it('refuse un state forge vers une adresse hors liste', async () => {
      const forged = encodeFlowState({ redirect: 'https://evil.com', challenge });

      await expect(controller.googleCallback({ user: { googleId: 'g' } }, forged, fakeRes()))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(auth.createGoogleCode).not.toHaveBeenCalled();
    });
  });
});
