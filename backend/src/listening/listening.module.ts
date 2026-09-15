import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FriendshipModule } from '../friendship/friendship.module';
import { ListeningService } from './listening.service';
import { ListeningController } from './listening.controller';
import { ListeningGateway } from './listening.gateway';
import { User } from '../users/user.entity';

// listening module (rest + gateway on the redis now playing)
@Module({
  imports: [
    FriendshipModule,
    // JwtAuthGuard verifie emailisVerified directement en base
    TypeOrmModule.forFeature([User]),
    // AuthModule n'exporte pas JwtModule : reenregistre avec le meme secret
    // pour que le gateway verifie le token du handshake
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [ListeningService, ListeningGateway],
  controllers: [ListeningController],
  exports: [ListeningService],
})
export class ListeningModule {}
