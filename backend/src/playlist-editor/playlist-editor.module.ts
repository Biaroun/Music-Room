import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistCollaborator } from './playlist-collaborator.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistTrack, PlaylistCollaborator, User])],
  controllers: [PlaylistEditorController],
  providers: [PlaylistEditorService],
  exports: [PlaylistEditorService],
})
export class PlaylistEditorModule {}
