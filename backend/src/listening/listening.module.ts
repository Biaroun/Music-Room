import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FriendshipModule } from '../friendship/friendship.module';
import { ListeningService } from './listening.service';
import { ListeningController } from './listening.controller';
import { ListeningGateway } from './listening.gateway';

@Module({
  imports: [
    FriendshipModule,
    // AuthModule n'exporte pas JwtModule : on le réenregistre avec le même secret
    // pour que le gateway puisse vérifier le token de la poignée de main.
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
