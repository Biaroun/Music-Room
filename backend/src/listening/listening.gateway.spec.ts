// TL;DR test the listening gateway (snapshot on connect no token = kick update before auth end)
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LogsService } from '../logs/logs.service';
import { ListeningGateway } from './listening.gateway';
import { ListeningService } from './listening.service';

describe('ListeningGateway', () => {
    let gateway: ListeningGateway;
    let listening: Record<string, jest.Mock>;

    beforeEach(async () => {
        listening = {
            getFriendsListening: jest.fn().mockResolvedValue([]),
            set: jest.fn().mockResolvedValue({ userId: 5, deezerId: '42' }),
            getAudience: jest.fn().mockResolvedValue({ me: { username: 'carol', avatar: null }, friendIds: [] }),
            clear: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListeningGateway,
                { provide: ListeningService, useValue: listening },
                { provide: JwtService, useValue: { verifyAsync: jest.fn().mockResolvedValue({ sub: 5, username: 'carol' }) } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
                { provide: CACHE_MANAGER, useValue: { get: jest.fn().mockResolvedValue(null) } },
                { provide: LogsService, useValue: { record: jest.fn() } },
            ],
        }).compile();

        gateway = module.get(ListeningGateway);
        gateway.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
    });

    it('joint la room et envoie le snapshot a la connexion', async () => {
        const client = { data: {}, handshake: { auth: { token: 'jwt' }, headers: {} }, join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() } as any;

        await gateway.handleConnection(client);

        expect(client.disconnect).not.toHaveBeenCalled();
        expect(client.join).toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith('listening:snapshot', []);
    });

    it('coupe un socket sans token', async () => {
        const client = { data: {}, handshake: { auth: {}, headers: {} }, join: jest.fn(), emit: jest.fn(), disconnect: jest.fn() } as any;

        await gateway.handleConnection(client);

        expect(client.disconnect).toHaveBeenCalledWith(true);
        expect(client.join).not.toHaveBeenCalled();
    });

    // meme course que TrackVoteGateway : un listening:update emis juste apres
    // 'connect' arrivait avant l'auth et etait jete en silence
    it('traite un update qui arrive avant la fin de handleConnection', async () => {
        const client = { data: {}, handshake: { auth: { token: 'jwt' }, headers: {} }, emit: jest.fn() } as any;

        await gateway.onUpdate(client, { deezerId: '42', title: 't', artist: 'a' } as any);

        expect(listening.set).toHaveBeenCalled();
        expect(listening.set.mock.calls[0][0]).toBe(5);
    });
});
