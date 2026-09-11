import {
    IsString,
    IsNotEmpty,
    MinLength,
    MaxLength,
    Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';


export class ResetPasswordDto {
    @ApiProperty({ description: 'Token received in the reset email' })
    @IsString()
    @IsNotEmpty({ message: 'Le lien de réinitialisation est incomplet.' })
    token: string;

    @ApiProperty({
        example: 'Test1234!@#$',
        description: 'Min 12 chars, must contain uppercase, lowercase, number and special char',
    })
    @IsString()
    @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères.' })
    @MaxLength(255, { message: 'Le mot de passe est trop long.' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
        message: 'Le mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial',
    })
    newPassword: string;
}
