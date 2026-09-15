import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// body when the app say what track is playing
export class UpdateListeningDto {
    @ApiProperty({ description: "L'id du morceau chez Deezer" })
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    deezerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    title: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    artist: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(512)
    cover?: string;
}
