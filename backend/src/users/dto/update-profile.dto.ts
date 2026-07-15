import {
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
    IsEmail,
    MaxLength, IsArray, IsEnum, IsOptional,ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {MusicGenre, Visibility, VisibilitySettings} from "../user.entity";

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
}

export class UpdateProfileDto {
    @ApiProperty({
        example: 'Hello World! I am a music lover.',
        description: 'Between 3 and 255 characters',
    })
    @IsString()
    @MaxLength(255, { message: "La bio est trop longue." })
    @IsOptional()
/*    @Matches(/^[a-zA-Z0-9 .,!?'_-]+$/, {
        message: "La bio contient des caractères non autorisés"
    })*/
    bio?: string;

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
        },
        description: 'Visibility settings for username, bio and music preferences',
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => VisibilitySettingsDto)
    visibilitySettings?: VisibilitySettingsDto;
}