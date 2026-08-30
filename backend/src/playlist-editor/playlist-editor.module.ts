import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistTrack])],
  controllers: [PlaylistEditorController],
  providers: [PlaylistEditorService],
  exports: [PlaylistEditorService],
})
export class PlaylistEditorModule {}
