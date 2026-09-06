import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistEditorController } from './playlist-editor.controller';
import { PlaylistEditorService } from './playlist-editor.service';
import { PlaylistEditorGateway } from './playlist-editor.gateway';

describe('PlaylistEditorController', () => {
  let controller: PlaylistEditorController;
  let service: Record<string, jest.Mock>;
  let gateway: { broadcastState: jest.Mock };

  beforeEach(async () => {
    service = {
      listCollaborators: jest.fn().mockResolvedValue([]),
      addCollaborator: jest.fn().mockResolvedValue({ id: 1 }),
      removeCollaborator: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn().mockResolvedValue({ id: 5 }),
      removeTrack: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue({ id: 10 }),
    };
    gateway = { broadcastState: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistEditorController],
      providers: [
        { provide: PlaylistEditorService, useValue: service },
        { provide: PlaylistEditorGateway, useValue: gateway },
      ],
    }).compile();

    controller = module.get<PlaylistEditorController>(PlaylistEditorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('adds a collaborator through the service', async () => {
    await controller.addCollaborator({ id: 1 }, 10, { userId: 2 });
    expect(service.addCollaborator).toHaveBeenCalledWith(10, 1, 2);
  });

  it('removes a collaborator through the service', async () => {
    await controller.removeCollaborator({ id: 1 }, 10, 2);
    expect(service.removeCollaborator).toHaveBeenCalledWith(10, 1, 2);
  });

  // Sans ca une edition faite en repli REST resterait invisible des clients
  // connectes en websocket.
  it('broadcasts to the room after a REST track add', async () => {
    await controller.addTrack({ id: 1 }, 10, { deezerId: 'd' } as any);
    expect(gateway.broadcastState).toHaveBeenCalledWith(10);
  });

  it('broadcasts to the room after a REST reorder', async () => {
    await controller.reorder({ id: 1 }, 10, { trackIds: [2, 1], version: 3 });
    expect(service.reorder).toHaveBeenCalledWith(10, 1, [2, 1], 3);
    expect(gateway.broadcastState).toHaveBeenCalledWith(10);
  });
});
