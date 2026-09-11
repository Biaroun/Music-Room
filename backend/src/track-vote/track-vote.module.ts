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
import { User } from '../users/user.entity';

@Module({
  imports: [
    // User : JwtAuthGuard en a besoin pour le controle emailisVerified
    TypeOrmModule.forFeature([Event, EventInvite, Vote, Playlist, PlaylistTrack, User]),
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
  controllers: [EventController, TrackVoteController],
  providers: [EventService, TrackVoteService, TrackVoteGateway],
})
export class TrackVoteModule {}
