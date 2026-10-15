import {
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
    IsEmail,
    MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// body to change the email (new email + current password)
export class UpdateEmailDto {


    @ApiProperty({
        example: 'john@example.com',
        description: 'Must be a valid email',
    })
    @IsString()
    @IsNotEmpty({ message: "L'adresse email est obligatoire." })
    @IsEmail({}, { message: "L'adresse email n'est pas valide." })
    @MaxLength(255, { message: "L'adresse email est trop longue." })
    newemail: string;

    @ApiProperty({
        example: 'Test1234!@#$',
        description: 'Your current password to confirm your identity',
    })
    @IsString()
    @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
    @MaxLength(255, { message: 'Le mot de passe est trop long.' })
    currentpassword: string;

}