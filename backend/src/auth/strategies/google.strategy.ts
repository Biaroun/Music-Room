import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider } from '../../users/user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private config: ConfigService,
    ) {
        super({
            clientID: config.get<string>('GOOGLE_CLIENT_ID_WEB')!,
            clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET_WEB')!,
            callbackURL: config.get<string>('GOOGLE_CALLBACK_URL_WEB')!,
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any) {
        return {
            email: profile.emails[0].value,
            username: profile.displayName,
            provider: OAuthProvider.GOOGLE,
        };
    }
}