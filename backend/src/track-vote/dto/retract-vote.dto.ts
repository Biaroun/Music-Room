import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';

// Recu en query string (?latitude=...&longitude=...) : @Type coerce la chaine
// en nombre, sans quoi class-validator rejette une valeur qui arrive en string.
export class RetractVoteDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsLatitude()
    latitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsLongitude()
    longitude?: number;
}
