import { Test, TestingModule } from '@nestjs/testing';
import { TrackVoteController } from './track-vote.controller';

describe('TrackVoteController', () => {
  let controller: TrackVoteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackVoteController],
    }).compile();

    controller = module.get<TrackVoteController>(TrackVoteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
