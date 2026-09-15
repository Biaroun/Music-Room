import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PlaylistLicenseMode } from '../playlist.entity';

// body to update a playlist (all fields optional)
export class UpdatePlaylistDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;

    @ApiProperty({
        required: false,
        enum: PlaylistLicenseMode,
        description: "Qui peut editer : 'open' = tout spectateur (defaut), 'invite-only' = proprietaire et invites",
    })
    @IsOptional()
    @IsEnum(PlaylistLicenseMode)
    licenseMode?: PlaylistLicenseMode;
}
