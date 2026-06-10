import {
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { Match } from '../decorators/match.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Between 3 and 255 characters',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255, { message: "L'username est trop long." })
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'Must be a valid email',
  })
  @IsString()
  @IsNotEmpty({ message: "L'adresse email est obligatoire." })
  @IsEmail({}, { message: "L'adresse email n'est pas valide." })
  @MaxLength(255, { message: "L'adresse email est trop longue." })
  email: string;

  @ApiProperty({
    example: 'Test1234!@#$',
    description: 'Min 12 chars, must contain uppercase, lowercase, number and special char',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(12, {
    message: 'Le mot de passe doit contenir au moins 12 caractères.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
        'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
  })
  @MaxLength(255, { message: 'Le mot de passe est trop long.' })
  password: string;

  @ApiProperty({
    example: 'Test1234!@#$',
    description: 'Must match password',
  })
  @IsString()
  @IsNotEmpty({ message: 'La confirmation du mot de passe est obligatoire.' })
  @Match('password', { message: 'Les mots de passe ne correspondent pas.' })
  passwordConfirm: string;
}