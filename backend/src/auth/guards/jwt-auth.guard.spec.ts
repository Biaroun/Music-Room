import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);

    const contextWith = (user: any) =>
        ({
            getHandler: () => ({}),
            getClass: () => ({}),
            switchToHttp: () => ({ getRequest: () => ({ user }) }),
        }) as unknown as ExecutionContext;

    function makeGuard(dbUser: { emailisVerified: boolean } | null, allowUnverified = false) {
        const reflector = { getAllAndOverride: jest.fn().mockReturnValue(allowUnverified) } as unknown as Reflector;
        const users = { findOneBy: jest.fn().mockResolvedValue(dbUser) } as any;
        return { guard: new JwtAuthGuard(reflector, users), users };
    }

    afterEach(() => jest.restoreAllMocks());

    // sujet v.1 : un compte cree mais pas verifie ne doit pas garder acces a
    // l'api juste parce que son jwt est encore valide
    it('refuse l acces si le mail n est pas verifie', async () => {
        jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);
        const { guard } = makeGuard({ emailisVerified: false });

        await expect(guard.canActivate(contextWith({ id: 1 }))).rejects.toThrow(ForbiddenException);
    });

    it('laisse passer un compte verifie', async () => {
        jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);
        const { guard } = makeGuard({ emailisVerified: true });

        await expect(guard.canActivate(contextWith({ id: 1 }))).resolves.toBe(true);
    });

    it('laisse passer une route marquee AllowUnverified sans toucher la base', async () => {
        jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);
        const { guard, users } = makeGuard({ emailisVerified: false }, true);

        await expect(guard.canActivate(contextWith({ id: 1 }))).resolves.toBe(true);
        expect(users.findOneBy).not.toHaveBeenCalled();
    });

    it('rejette direct si l authentification jwt echoue, sans requete base', async () => {
        jest.spyOn(parentProto, 'canActivate').mockResolvedValue(false);
        const { guard, users } = makeGuard({ emailisVerified: true });

        await expect(guard.canActivate(contextWith({ id: 1 }))).resolves.toBe(false);
        expect(users.findOneBy).not.toHaveBeenCalled();
    });
});
