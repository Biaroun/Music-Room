import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { PlaylistEditorGateway } from './playlist-editor.gateway';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Playlist, PlaylistTrack, PlaylistCollaborator, User]),
    // AuthModule n'exporte pas JwtModule : on le reenregistre avec le meme
    // secret pour que le gateway puisse verifier le token de la poignee de main
    // (meme pattern que TrackVoteModule).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PlaylistEditorController],
  providers: [PlaylistEditorService, PlaylistEditorGateway],
  exports: [PlaylistEditorService],
})
export class PlaylistEditorModule {}
