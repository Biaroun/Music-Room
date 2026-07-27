import {BadRequestException, ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import {OAuthProvider, Visibility} from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {JwtService} from "@nestjs/jwt";
import {LoginDto} from "./dto/login.dto";
import {MailService} from "../mail/mail.service";
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import {ConfigService} from "@nestjs/config";

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
              private jwtservice: JwtService,
              private mailService: MailService,
              private config: ConfigService,
              @Inject(CACHE_MANAGER) private cacheManager: Cache,) {}

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

  async logout(token: string): Promise<void> {
    const payload = this.jwtservice.decode(token) as { exp: number };
    const ttl = payload.exp - Math.floor(Date.now() / 1000);

    if (ttl > 0) {
      await this.cacheManager.set(`blacklist:${token}`, true, ttl * 1000);
    }
  }

  async handleOAuthUser(email: string, username: string, provider: OAuthProvider): Promise<{ access_token: string }> {
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      user = await this.usersService.create({
        email,
        username,
        oAuthProvider: provider,
        emailisVerified: true,
      });
    }

    return {
      access_token: this.jwtservice.sign({ sub: user.id, username: user.username }),
    };
  }

  async verifyGoogleToken(token: string): Promise<{ email: string; username: string }> {
    const client = new OAuth2Client();

    const audiences = [
      this.config.get<string>('GOOGLE_CLIENT_ID_ANDROID')!,
    ];

    const iosClientId = this.config.get<string>('GOOGLE_CLIENT_ID_IOS');
    if (iosClientId) {
      audiences.push(iosClientId);
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: audiences,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return {
      email: payload.email!,
      username: payload.name!,
    };
  }

  async forgot_password(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'If this email exists, a reset link has been sent' };
    }
    const token = await this.usersService.generatePasswordResetToken(user.id);
    await this.mailService.sendPasswordResetEmail(user.email, token);
    return { message: 'If this email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const success = await this.usersService.verifyPasswordResetToken(token, newPassword);
    if (!success) {
      throw new BadRequestException('Invalid or expired token');
    }
    return { message: 'Password reset successfully' };
  }
}
