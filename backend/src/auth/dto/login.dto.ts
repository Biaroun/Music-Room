import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'johndoe or john@example.com',
    description: 'Username or email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le login est obligatoire.' })
  login: string;

  @ApiProperty({
    example: 'Test1234!@#$',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password: string;
}