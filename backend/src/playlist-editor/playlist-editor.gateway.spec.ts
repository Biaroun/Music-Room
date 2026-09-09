import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LogsService } from '../logs/logs.service';
import { ConflictException } from '@nestjs/common';
import { PlaylistEditorGateway, playlistRoomOf } from './playlist-editor.gateway';
import { PlaylistEditorService } from './playlist-editor.service';

describe('PlaylistEditorGateway', () => {
  let gateway: PlaylistEditorGateway;
  let service: Record<string, jest.Mock>;
  let emit: jest.Mock;

  const STATE = { id: 10, version: 4, tracks: [] } as any;

  function socket(userId = 1) {
    return { data: { userId, username: 'u' }, join: jest.fn(), leave: jest.fn(), emit: jest.fn() } as any;
  }

  beforeEach(async () => {
    service = {
      assertCanView: jest.fn().mockResolvedValue({ id: 10 }),
      getState: jest.fn().mockResolvedValue(STATE),
      addTrack: jest.fn().mockResolvedValue({ id: 5 }),
      removeTrack: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue(STATE),
    };
    emit = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistEditorGateway,
        { provide: PlaylistEditorService, useValue: service },
        { provide: JwtService, useValue: { verifyAsync: jest.fn().mockResolvedValue({ sub: 1, username: 'u' }) } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn().mockResolvedValue(null) } },
        // @UseInterceptors sur le gateway fait de LogsInterceptor un injectable
        // du module de test, qui reclame donc LogsService
        { provide: LogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    gateway = module.get(PlaylistEditorGateway);
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as any;
  });

  it('sends the state only to the joining socket', async () => {
    const client = socket();

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).toHaveBeenCalledWith(playlistRoomOf(10));
    expect(client.emit).toHaveBeenCalledWith('playlist:state', STATE);
    expect(emit).not.toHaveBeenCalled();
  });

  // handleConnection est async : un join emis juste apres 'connect' arrive
  // avant que client.data.userId soit pose
  it('still serves a join that arrives before handleConnection has authenticated', async () => {
    const client = { data: {}, handshake: { auth: { token: 'jwt' }, headers: {} }, join: jest.fn(), emit: jest.fn() } as any;

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).toHaveBeenCalledWith(playlistRoomOf(10));
    expect(client.emit).toHaveBeenCalledWith('playlist:state', STATE);
  });

  it('ignores a join from a socket with no usable token', async () => {
    const client = { data: {}, handshake: { auth: {}, headers: {} }, join: jest.fn(), emit: jest.fn() } as any;

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).not.toHaveBeenCalled();
  });

  it('refuses to join a playlist the user cannot view', async () => {
    service.assertCanView.mockRejectedValue(new Error('nope'));
    const client = socket();

    await gateway.onJoin(client, { playlistId: 10 });

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('playlist:error', { message: 'Cannot open this playlist' });
  });

  it('broadcasts the state to the whole room after an add', async () => {
    await gateway.onAddTrack(socket(), {
      playlistId: 10, deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u',
    } as any);

    expect(gateway.server.to).toHaveBeenCalledWith(playlistRoomOf(10));
    expect(emit).toHaveBeenCalledWith('playlist:state', STATE);
  });

  it('does not leak the playlistId into the track it saves', async () => {
    await gateway.onAddTrack(socket(), {
      playlistId: 10, deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u',
    } as any);

    expect(service.addTrack).toHaveBeenCalledWith(10, 1, {
      deezerId: 'd', title: 't', artist: 'a', previewUrl: 'u',
    });
  });

  it('broadcasts the state to the whole room after a remove', async () => {
    await gateway.onRemoveTrack(socket(), { playlistId: 10, trackId: 5 });

    expect(emit).toHaveBeenCalledWith('playlist:state', STATE);
  });

  it('sends playlist:conflict to the sender and does not broadcast on a stale reorder', async () => {
    service.reorder.mockRejectedValue(new ConflictException('stale'));
    const client = socket();

    await gateway.onReorder(client, { playlistId: 10, trackIds: [2, 1], version: 1 });

    expect(client.emit).toHaveBeenCalledWith('playlist:conflict', { message: 'stale', state: STATE });
    expect(emit).not.toHaveBeenCalled();
  });

  it('reports a refused edit to the sender without broadcasting', async () => {
    service.addTrack.mockRejectedValue(new Error('You are not an editor of this playlist'));
    const client = socket();

    await gateway.onAddTrack(client, { playlistId: 10, deezerId: 'd' } as any);

    expect(client.emit).toHaveBeenCalledWith('playlist:error', {
      message: 'You are not an editor of this playlist',
    });
    expect(emit).not.toHaveBeenCalled();
  });
});
