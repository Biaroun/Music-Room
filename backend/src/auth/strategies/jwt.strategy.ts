import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private config: ConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get<string>('JWT_SECRET')!,
            passReqToCallback: true,
        });
    }

    async validate(req: any, payload: { sub: number; username: string }) {
        const token = req.headers.authorization?.split(' ')[1];

        const isBlacklisted = await this.cacheManager.get(`blacklist:${token}`);
        if (isBlacklisted) {
            throw new UnauthorizedException();
        }

        return { id: payload.sub, username: payload.username };
    }
}