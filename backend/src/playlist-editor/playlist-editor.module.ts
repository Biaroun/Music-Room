import { Module } from '@nestjs/common';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';

@Module({
  controllers: [PlaylistEditorController],
  providers: [PlaylistEditorService]
})
export class PlaylistEditorModule {}
