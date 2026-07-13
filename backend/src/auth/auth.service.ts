import {ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Visibility } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {JwtService} from "@nestjs/jwt";
import {LoginDto} from "./dto/login.dto";
import {MailService} from "../mail/mail.service";

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
              private jwtservice: JwtService,
              private mailService: MailService) {}

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
      visibilitySettings: {
        username: Visibility.PUBLIC,
        bio: Visibility.PUBLIC,
        musicPreferences: Visibility.PUBLIC,
      },
    });

    const tokenverif = await this.usersService.generateEmailVerificationToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, tokenverif);
    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }

  async login(data: LoginDto): Promise<{ access_token: string }> {
    const isEmail = data.login.includes('@');

    let user;
    if (isEmail)
      user = await this.usersService.findByEmail(data.login);
    else
      user = await this.usersService.findByUsername(data.login);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!await bcrypt.compare(data.password, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }
}
