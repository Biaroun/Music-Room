import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

// body to import one of my playlists
export class ImportPlaylistDto {
    @ApiProperty({ description: "Id d'une de mes playlists a copier dans cet event" })
    @IsInt()
    playlistId: number;
}
