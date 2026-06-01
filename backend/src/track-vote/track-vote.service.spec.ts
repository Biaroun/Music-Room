import { Test, TestingModule } from '@nestjs/testing';
import { TrackVoteService } from './track-vote.service';

describe('TrackVoteService', () => {
  let service: TrackVoteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrackVoteService],
    }).compile();

    service = module.get<TrackVoteService>(TrackVoteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
