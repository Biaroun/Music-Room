import { Test, TestingModule } from '@nestjs/testing';
import { MusicDelegationService } from './music-delegation.service';

describe('MusicDelegationService', () => {
  let service: MusicDelegationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MusicDelegationService],
    }).compile();

    service = module.get<MusicDelegationService>(MusicDelegationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
