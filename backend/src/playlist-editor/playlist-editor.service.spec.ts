import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlaylistEditorService } from './playlist-editor.service';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';

describe('PlaylistEditorService', () => {
  let service: PlaylistEditorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistEditorService,
        { provide: getRepositoryToken(Playlist), useValue: {} },
        { provide: getRepositoryToken(PlaylistTrack), useValue: {} },
      ],
    }).compile();

    service = module.get<PlaylistEditorService>(PlaylistEditorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
