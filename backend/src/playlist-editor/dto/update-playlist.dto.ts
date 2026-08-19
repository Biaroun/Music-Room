import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
