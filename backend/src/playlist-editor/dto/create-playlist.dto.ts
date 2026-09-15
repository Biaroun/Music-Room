import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// body to create a playlist
export class CreatePlaylistDto {
    @ApiProperty({ example: 'My Playlist' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({ example: true, required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean;
}
