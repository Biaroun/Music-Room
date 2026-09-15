import {
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
    IsEmail,
    MaxLength, IsArray, IsEnum, IsOptional,ValidateNested, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {MusicGenre, Visibility, VisibilitySettings} from "../user.entity";

// a garder en phase avec mobile/src/config/avatars.ts, pas de package partage
export const AVATAR_IDS = [
    'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4',
    'avatar-5', 'avatar-6', 'avatar-7', 'avatar-8',
] as const;

// nested dto for the visibility (each field optional)
export class VisibilitySettingsDto {
    @IsEnum(Visibility)
    @IsOptional()
    username?: Visibility;

    @IsEnum(Visibility)
    @IsOptional()
    bio?: Visibility;

    @IsEnum(Visibility)
    @IsOptional()
    musicPreferences?: Visibility;

    // sans ce champ, whitelist:true du ValidationPipe le supprimerait
    // silencieusement de la requete
    @IsEnum(Visibility)
    @IsOptional()
    listening?: Visibility;
}

// body to update the profile (all optional)
export class UpdateProfileDto {
    @ApiProperty({
        example: 'Hello World! I am a music lover.',
        description: 'Between 3 and 255 characters',
    })
    @IsString()
    @MaxLength(255, { message: "La bio est trop longue." })
    @IsOptional()
    bio?: string;

    @ApiProperty({
        example: 'avatar-3',
        description: "Un des 8 avatars predefinis (avatar-1..avatar-8), ou '' pour aucun avatar",
    })
    // one of the 8 ids or empty string to remove
    @IsIn([...AVATAR_IDS, ''])
    @IsOptional()
    avatar?: string;

    @ApiProperty({
        example: ['rap', 'rock'],
        enum: MusicGenre,
        isArray: true,
    })
    @IsArray()
    @IsEnum(MusicGenre, { each: true })
    @IsOptional()
    musicpreferences?: MusicGenre[];

    @ApiProperty({
        example: {
            username: 'public',
            bio: 'friends-only',
            musicPreferences: 'private',
            listening: 'friends-only',
        },
        description: 'Visibility settings for username, bio, music preferences and current listening',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => VisibilitySettingsDto)
    visibilitySettings?: VisibilitySettingsDto;
}