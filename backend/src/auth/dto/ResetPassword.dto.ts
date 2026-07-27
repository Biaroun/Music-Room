import {
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
} from 'class-validator';


export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @MinLength(12)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
        message: 'Le mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial',
    })
    newPassword: string;
}