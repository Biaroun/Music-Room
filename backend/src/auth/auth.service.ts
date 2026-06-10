import { ConflictException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {JwtService} from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
              private jwtservice: JwtService,) {}

  async register(data: RegisterDto): Promise<{ access_token: string }> {
    if (await this.usersService.isAlreadyExist('email', data.email)) {
      throw new ConflictException('Email already exists');
    }
    if (await this.usersService.isAlreadyExist('username', data.username)) {
      throw new ConflictException('Username already exists');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const { passwordConfirm, ...userData} = data;
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
    });
    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }
}
