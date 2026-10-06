import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthGuard } from './google-auth.guard';
import { decodeFlowState } from '../google-flow';

describe('GoogleAuthGuard', () => {
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const guard = new GoogleAuthGuard({ get: () => 'http://localhost:8082,exp://' } as unknown as ConfigService);

    const contextWith = (req: any) =>
        ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

    describe('depart du flux', () => {
        it('met la redirection et le challenge dans le state', () => {
            const options: any = guard.getAuthenticateOptions(
                contextWith({ query: { redirect: 'exp://10.0.2.2:8081/--/auth', challenge } }),
            );

            expect(decodeFlowState(options.state)).toEqual({ redirect: 'exp://10.0.2.2:8081/--/auth', challenge });
            expect(options.prompt).toBe('select_account');
        });

        it('refuse une redirection hors liste', () => {
            expect(() => guard.getAuthenticateOptions(
                contextWith({ query: { redirect: 'https://evil.com', challenge } }),
            )).toThrow(BadRequestException);
        });

        it('refuse un depart sans challenge', () => {
            expect(() => guard.getAuthenticateOptions(
                contextWith({ query: { redirect: 'http://localhost:8082' } }),
            )).toThrow(BadRequestException);
        });
    });

    describe('retour de google', () => {
        it('laisse passer l\'utilisateur', () => {
            const user = { googleId: 'g' };
            expect(guard.handleRequest(null, user, null, contextWith({ query: { code: 'x' } }))).toBe(user);
        });

        it('note l\'annulation au lieu de lever un 401', () => {
            const req: any = { query: { error: 'access_denied' } };

            expect(guard.handleRequest(null, false, null, contextWith(req))).toBeNull();
            expect(req.googleError).toBe('Google sign-in was cancelled');
        });

        it('garde le message d\'un refus volontaire (mail non verifie)', () => {
            const req: any = { query: { code: 'x' } };

            guard.handleRequest(new UnauthorizedException('Google account has no verified email'), false, null, contextWith(req));
            expect(req.googleError).toBe('Google account has no verified email');
        });

        it('cache le detail d\'une erreur interne', () => {
            const req: any = { query: { code: 'x' } };

            guard.handleRequest(new Error('invalid_grant: secret mismatch'), false, null, contextWith(req));
            expect(req.googleError).toBe('Google sign-in failed');
        });
    });
});
