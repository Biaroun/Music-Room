import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

// body to invite an editor
export class AddCollaboratorDto {
    @ApiProperty({ description: "id de l'utilisateur a qui donner le droit d'edition" })
    @IsInt()
    userId: number;
}
