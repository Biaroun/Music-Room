import {
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
    IsEmail,
    MaxLength,
} from 'class-validator';
import { Match } from '../../auth/decorators/match.decorator';
import { ApiProperty } from '@nestjs/swagger';

// body to change the password (current + new + confirm)
export class UpdatePasswordDto {
    @ApiProperty({
        example: 'Test1234!@#$',
        description: 'Your current password to confirm your identity',
    })
    @IsString()
    @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
    @MaxLength(255, { message: 'Le mot de passe est trop long.' })
    currentpassword: string;

    @ApiProperty({
        example: 'Test1234!@#$',
        description: 'Min 12 chars, must contain uppercase, lowercase, number and special char',
    })
    @IsString()
    @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
    @MinLength(12, {
        message: 'Le mot de passe doit contenir au moins 12 caractères.',
    })
    // lookaheads = at least 1 lower 1 upper 1 digit 1 special char
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
        message:
            'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
    })
    @MaxLength(255, { message: 'Le mot de passe est trop long.' })
    newpassword: string;

    @ApiProperty({
        example: 'Test1234!@#$',
        description: 'Must match password',
    })
    @IsString()
    @IsNotEmpty({ message: 'La confirmation du mot de passe est obligatoire.' })
    @Match('newpassword', { message: 'Les mots de passe ne correspondent pas.' })
    newpasswordConfirm: string;
}