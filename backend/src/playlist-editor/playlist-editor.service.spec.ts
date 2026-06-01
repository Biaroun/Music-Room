import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistEditorService } from './playlist-editor.service';

describe('PlaylistEditorService', () => {
  let service: PlaylistEditorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlaylistEditorService],
    }).compile();

    service = module.get<PlaylistEditorService>(PlaylistEditorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
