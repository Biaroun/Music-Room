import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddTrackDto {
    @ApiProperty({ description: "L'id du morceau chez Deezer" })
    @IsString()
    @IsNotEmpty()
    deezerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    artist: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    artistId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    cover?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    previewUrl: string;

    @ApiProperty({ required: false, description: 'Deezer renvoie le bpm en float (ex: 118.6), pas un entier' })
    @IsOptional()
    @IsNumber()
    bpm?: number;
}
