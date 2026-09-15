// TL;DR test the track vote gateway join and vote (even before handleConnection end)
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LogsService } from '../logs/logs.service';
import { TrackVoteGateway, eventRoomOf } from './track-vote.gateway';
import { TrackVoteService } from './track-vote.service';
import { EventService } from './event.service';

describe('TrackVoteGateway', () => {
    let gateway: TrackVoteGateway;
    let events: Record<string, jest.Mock>;
    let trackVote: Record<string, jest.Mock>;

    // pas de nowPlaying : scheduleTick s'arrete tout de suite, on ne laisse pas
    // trainer de minuteur entre deux tests
    const BOARD = { eventId: 7, tracks: [], nowPlaying: null } as any;

    beforeEach(async () => {
        events = { assertCanView: jest.fn().mockResolvedValue({ id: 7 }), assertCanVote: jest.fn() };
        trackVote = { getBoard: jest.fn().mockResolvedValue(BOARD), castVote: jest.fn(), retractVote: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TrackVoteGateway,
                { provide: EventService, useValue: events },
                { provide: TrackVoteService, useValue: trackVote },
                { provide: JwtService, useValue: { verifyAsync: jest.fn().mockResolvedValue({ sub: 3, username: 'bob' }) } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
                { provide: CACHE_MANAGER, useValue: { get: jest.fn().mockResolvedValue(null) } },
                { provide: LogsService, useValue: { record: jest.fn() } },
            ],
        }).compile();

        gateway = module.get(TrackVoteGateway);
        gateway.server = { in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([]) }) } as any;
    });

    it('sert un join sur un socket deja authentifie', async () => {
        const client = { data: { userId: 3, username: 'bob' }, join: jest.fn(), emit: jest.fn() } as any;

        await gateway.onJoin(client, { eventId: 7 });

        expect(client.join).toHaveBeenCalledWith(eventRoomOf(7));
        expect(client.emit).toHaveBeenCalledWith('vote:board', BOARD);
    });

    /**
     * handleConnection est async alors que 'connect' part cote client des que la
     * connexion est etablie : un event:join emis dans la foulee arrivait avant
     * l'auth et etait jete en silence. reproduit a 0/12 en conditions reelles.
     */
    it('sert un join qui arrive avant la fin de handleConnection', async () => {
        const client = { data: {}, handshake: { auth: { token: 'jwt' }, headers: {} }, join: jest.fn(), emit: jest.fn() } as any;

        await gateway.onJoin(client, { eventId: 7 });

        expect(client.join).toHaveBeenCalledWith(eventRoomOf(7));
        expect(client.emit).toHaveBeenCalledWith('vote:board', BOARD);
    });

    it('ignore un join sans token exploitable', async () => {
        const client = { data: {}, handshake: { auth: {}, headers: {} }, join: jest.fn(), emit: jest.fn() } as any;

        await gateway.onJoin(client, { eventId: 7 });

        expect(client.join).not.toHaveBeenCalled();
        expect(client.emit).not.toHaveBeenCalled();
    });

    it('refuse un event que l utilisateur ne peut pas voir', async () => {
        events.assertCanView.mockRejectedValue(new Error('nope'));
        const client = { data: { userId: 3 }, join: jest.fn(), emit: jest.fn() } as any;

        await gateway.onJoin(client, { eventId: 7 });

        expect(client.join).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith('vote:error', { message: 'Cannot join this event' });
    });

    it('vote sur un socket pas encore authentifie', async () => {
        const client = { data: {}, handshake: { auth: { token: 'jwt' }, headers: {} }, emit: jest.fn() } as any;

        await gateway.onCastVote(client, { eventId: 7, trackId: 12 } as any);

        expect(trackVote.castVote).toHaveBeenCalledWith(7, 3, 12);
    });
});
