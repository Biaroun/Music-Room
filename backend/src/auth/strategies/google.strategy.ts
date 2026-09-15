import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleIdentity } from '../../users/user.entity';

// passport strategy for the google web oauth flow
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

    // turn the google profile into our GoogleIdentity
    async validate(accessToken: string, refreshToken: string, profile: any): Promise<GoogleIdentity> {
        const email = profile.emails?.[0]?.value;
        // une adresse non verifiee chez google ne prouve rien
        if (!email || profile._json?.email_verified === false)
            throw new UnauthorizedException('Google account has no verified email');
        return {
            googleId: profile.id,
            email,
            username: profile.displayName || email.split('@')[0],
        };
    }
}
