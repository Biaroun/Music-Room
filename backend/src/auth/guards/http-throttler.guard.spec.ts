// TL;DR test the throttler guard (ws skip client ip allowlist) and that auth routes are limited
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HttpThrottlerGuard, isAllowlisted, throttleAllowlist } from './http-throttler.guard';
import { AUTH_THROTTLE_LIMIT, AUTH_THROTTLE_TTL_MS } from '../auth-throttle';
import { AuthController } from '../auth.controller';

describe('HttpThrottlerGuard', () => {
    const guard = new HttpThrottlerGuard({} as any, {} as any, {} as any);

    const contextOfType = (type: string) => ({ getType: () => type }) as unknown as ExecutionContext;

    // ThrottlerGuard lit switchToHttp(), vide hors http : le court-circuit doit
    // tenir si le guard est un jour pose a la main sur un gateway
    it('laisse passer les messages websocket', async () => {
        const parent = jest.spyOn(ThrottlerGuard.prototype, 'canActivate');
        await expect(guard.canActivate(contextOfType('ws'))).resolves.toBe(true);
        expect(parent).not.toHaveBeenCalled();
        parent.mockRestore();
    });

    it('delegue au throttler pour le HTTP', async () => {
        const parent = jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
        await guard.canActivate(contextOfType('http'));
        expect(parent).toHaveBeenCalled();
        parent.mockRestore();
    });

    describe('getTracker', () => {
        const track = (req: any) => (guard as any).getTracker(req);

        it('prend l IP du client derriere un proxy', async () => {
            await expect(track({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } })).resolves.toBe(
                '203.0.113.7',
            );
        });

        it('retombe sur request.ip en direct', async () => {
            await expect(track({ headers: {}, ip: '10.0.2.2' })).resolves.toBe('10.0.2.2');
        });
    });
});

describe('throttleAllowlist', () => {
    const contextOf = (request: any) =>
        ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => request }) }) as any;

    it('est vide quand la variable n est pas posee', () => {
        expect(throttleAllowlist(undefined)).toEqual([]);
        expect(throttleAllowlist('  ')).toEqual([]);
    });

    it('ne saute rien quand la liste est vide', () => {
        expect(isAllowlisted(contextOf({ ip: '127.0.0.1', headers: {} }), [])).toBe(false);
    });

    it('exempte une IP listee', () => {
        const allowlist = throttleAllowlist('127.0.0.1, 10.0.0.5');
        expect(isAllowlisted(contextOf({ ip: '10.0.0.5', headers: {} }), allowlist)).toBe(true);
        expect(isAllowlisted(contextOf({ ip: '10.0.0.6', headers: {} }), allowlist)).toBe(false);
    });

    // express rend 127.0.0.1 en ::ffff:127.0.0.1 en dual-stack : sans
    // normalisation l'allowlist ne matche jamais en local
    it('normalise une IPv4 mappee en IPv6', () => {
        expect(isAllowlisted(contextOf({ ip: '::ffff:127.0.0.1', headers: {} }), ['127.0.0.1'])).toBe(true);
    });
});

describe('ThrottleAuth', () => {
    // sujet v.6 : les routes qui verifient un secret doivent etre plafonnees
    it.each(['register', 'login', 'forgot_password', 'reset_password', 'verifyMail'])(
        'plafonne %s',
        (method) => {
            const handler = (AuthController.prototype as any)[method];
            // @Throttle suffixe la cle par le nom du limiteur
            expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(AUTH_THROTTLE_LIMIT);
            expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(AUTH_THROTTLE_TTL_MS);
        },
    );

    it('reste a une limite serree', () => {
        expect(AUTH_THROTTLE_LIMIT).toBeLessThanOrEqual(10);
        expect(AUTH_THROTTLE_TTL_MS).toBeGreaterThanOrEqual(60_000);
    });
});
