import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistEditorController } from './playlist-editor.controller';

describe('PlaylistEditorController', () => {
  let controller: PlaylistEditorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistEditorController],
    }).compile();

    controller = module.get<PlaylistEditorController>(PlaylistEditorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
