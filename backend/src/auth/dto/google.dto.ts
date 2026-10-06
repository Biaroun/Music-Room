import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PKCE_VERIFIER } from '../google-flow';

export class GoogleCodeDto {
    @ApiProperty({ description: 'Code from the app url fragment (#code=...) after the Google flow' })
    @IsString()
    @Matches(/^[a-f0-9]{48}$/, { message: 'Invalid Google sign-in code' })
    code: string;

    @ApiProperty({ description: 'PKCE verifier whose sha256 (base64url) was sent as challenge to GET /auth/google/web' })
    @IsString()
    @Matches(PKCE_VERIFIER, { message: 'Invalid PKCE verifier' })
    verifier: string;
}

export class GoogleIdTokenDto {
    @ApiProperty({ description: 'Google id token obtained by the app' })
    @IsString()
    @IsNotEmpty()
    token: string;
}
