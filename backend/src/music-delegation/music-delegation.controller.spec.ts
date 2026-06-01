import { Test, TestingModule } from '@nestjs/testing';
import { MusicDelegationController } from './music-delegation.controller';

describe('MusicDelegationController', () => {
  let controller: MusicDelegationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MusicDelegationController],
    }).compile();

    controller = module.get<MusicDelegationController>(MusicDelegationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
