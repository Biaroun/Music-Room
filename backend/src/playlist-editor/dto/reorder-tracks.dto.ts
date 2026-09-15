import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional } from 'class-validator';

// body to reorder (all the track ids in the new order + version)
export class ReorderTracksDto {
    @ApiProperty({ type: [Number], description: "ids des lignes de tracks, dans l'ordre voulu" })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    trackIds: number[];

    @ApiProperty({
        required: false,
        description: 'Version de playlist vue par le client. Si elle est perimee, le reorder est refuse en 409.',
    })
    @IsOptional()
    @IsInt()
    version?: number;
}
