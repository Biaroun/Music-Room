import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class ReorderTracksDto {
    @ApiProperty({ type: [Number], description: "ids des lignes de tracks, dans l'ordre voulu" })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    trackIds: number[];
}
