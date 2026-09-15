import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {JwtStrategy} from "./strategies/jwt.strategy";
import {MailModule} from "../mail/mail.module";
import {GoogleStrategy} from "./strategies/google.strategy";

// auth module (register login google jwt strategy)
@Module({
  imports: [
    UsersModule,
    MailModule,
    // JwtAuthGuard verifie emailisVerified directement en base
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // the jwt stay valid 7 days
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
})
export class AuthModule {}