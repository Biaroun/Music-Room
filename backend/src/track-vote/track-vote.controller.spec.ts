import { Test, TestingModule } from '@nestjs/testing';
import { TrackVoteController } from './track-vote.controller';
import { EventService } from './event.service';
import { TrackVoteService } from './track-vote.service';
import { TrackVoteGateway } from './track-vote.gateway';

describe('TrackVoteController', () => {
  let controller: TrackVoteController;
  let events: { assertCanView: jest.Mock; assertCanVote: jest.Mock };
  let trackVote: { getBoard: jest.Mock; suggestTrack: jest.Mock; castVote: jest.Mock; retractVote: jest.Mock };
  let gateway: { broadcastBoard: jest.Mock };

  beforeEach(async () => {
    events = { assertCanView: jest.fn(), assertCanVote: jest.fn() };
    trackVote = {
      getBoard: jest.fn(),
      suggestTrack: jest.fn(),
      castVote: jest.fn(),
      retractVote: jest.fn(),
    };
    gateway = { broadcastBoard: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrackVoteController],
      providers: [
        { provide: EventService, useValue: events },
        { provide: TrackVoteService, useValue: trackVote },
        { provide: TrackVoteGateway, useValue: gateway },
      ],
    }).compile();

    controller = module.get<TrackVoteController>(TrackVoteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('castVote', () => {
    it('checks assertCanVote before casting and broadcasts the updated board', async () => {
      events.assertCanVote.mockResolvedValue(undefined);
      trackVote.getBoard.mockResolvedValue({ tracks: [], updatedAt: 1 });

      await controller.castVote({ id: 1 }, 10, { trackId: 42 });

      expect(events.assertCanVote).toHaveBeenCalledWith(10, 1, undefined);
      expect(trackVote.castVote).toHaveBeenCalledWith(10, 1, 42);
      expect(gateway.broadcastBoard).toHaveBeenCalledWith(10);
    });

    it('forwards latitude/longitude as a position when provided', async () => {
      events.assertCanVote.mockResolvedValue(undefined);
      trackVote.getBoard.mockResolvedValue({ tracks: [], updatedAt: 1 });

      await controller.castVote({ id: 1 }, 10, { trackId: 42, latitude: 48.8, longitude: 2.3 });

      expect(events.assertCanVote).toHaveBeenCalledWith(10, 1, { latitude: 48.8, longitude: 2.3 });
    });
  });

  describe('getBoard', () => {
    it('checks assertCanView before returning the board', async () => {
      events.assertCanView.mockResolvedValue(undefined);
      trackVote.getBoard.mockResolvedValue({ tracks: [], updatedAt: 1 });

      const result = await controller.getBoard({ id: 1 }, 10);

      expect(events.assertCanView).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({ tracks: [], updatedAt: 1 });
    });
  });
});
