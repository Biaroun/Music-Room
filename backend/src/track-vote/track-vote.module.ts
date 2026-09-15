import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackVoteController } from './track-vote.controller';
import { TrackVoteService } from './track-vote.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { TrackVoteGateway } from './track-vote.gateway';
import { Event } from './event.entity';
import { EventInvite } from './event-invite.entity';
import { Vote } from './vote.entity';
import { Playlist } from '../playlist-editor/playlist.entity';
import { PlaylistTrack } from '../playlist-editor/playlist-track.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { User } from '../users/user.entity';

// track vote module (events votes gateway)
@Module({
  imports: [
    // User : JwtAuthGuard en a besoin pour le controle emailisVerified
    TypeOrmModule.forFeature([Event, EventInvite, Vote, Playlist, PlaylistTrack, User]),
    SubscriptionModule,
    // AuthModule n'exporte pas JwtModule : on le reenregistre avec le meme
    // secret pour que le gateway puisse verifier le token de la poignee de main
    // (meme pattern que ListeningModule).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [EventController, TrackVoteController],
  providers: [EventService, TrackVoteService, TrackVoteGateway],
})
export class TrackVoteModule {}
