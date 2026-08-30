import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

export class CastVoteDto {
    @ApiProperty({ description: 'Id de la piste (PlaylistTrack) pour laquelle voter' })
    @IsInt()
    trackId: number;

    // Requis uniquement si la licence de l'event est geo-time-restricted ; le
    // controle se fait dans le service car il depend de la licence de l'event,
    // pas du DTO seul.
    @ApiProperty({ required: false })
    @IsOptional()
    @IsLatitude()
    latitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsLongitude()
    longitude?: number;
}
