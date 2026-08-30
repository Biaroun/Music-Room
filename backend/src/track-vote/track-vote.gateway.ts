import { Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventService } from './event.service';
import { Board, TrackVoteService } from './track-vote.service';
import { CastVoteDto } from './dto/cast-vote.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };
type Timer = ReturnType<typeof setTimeout>;

export function eventRoomOf(eventId: number): string {
    return `event:${eventId}`;
}

/**
 * Meme namespace '/realtime' que ListeningGateway : un seul socket cote mobile
 * pour l'ecoute en cours et le vote. Rooms par event (pas par utilisateur) :
 * tous les participants d'un event recoivent le meme board.
 * REST reste la source de verite / le repli (voir TrackVoteController) ; ce
 * gateway ne fait que pousser les recalculs de board a la room.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class TrackVoteGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(TrackVoteGateway.name);
    // Un minuteur par event, arme sur la fin du morceau en cours : c'est lui
    // qui pousse l'avancee automatique de la file sans attendre qu'un client
    // rafraichisse. S'auto-eteint des que plus personne n'est dans la room.
    private tickers = new Map<number, Timer>();

    constructor(
        private events: EventService,
        private trackVote: TrackVoteService,
        private jwt: JwtService,
        private config: ConfigService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    async handleConnection(client: AuthedSocket) {
        const token = this.extractToken(client);
        if (!token) return client.disconnect(true);

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; username: string }>(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });
            if (await this.cache.get(`blacklist:${token}`)) return client.disconnect(true);

            client.data.userId = payload.sub;
            client.data.username = payload.username;
        } catch {
            client.disconnect(true);
        }
    }

    @SubscribeMessage('event:join')
    async onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { eventId: number }) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.events.assertCanView(dto.eventId, userId);
        } catch {
            client.emit('vote:error', { message: 'Cannot join this event' });
            return;
        }
        await client.join(eventRoomOf(dto.eventId));
        const board = await this.trackVote.getBoard(dto.eventId, userId);
        client.emit('vote:board', board);
        this.scheduleTick(dto.eventId, board);
    }

    @SubscribeMessage('event:leave')
    async onLeave(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { eventId: number }) {
        await client.leave(eventRoomOf(dto.eventId));
    }

    @SubscribeMessage('vote:cast')
    async onCastVote(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: CastVoteDto & { eventId: number }) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            const position =
                dto.latitude != null && dto.longitude != null
                    ? { latitude: dto.latitude, longitude: dto.longitude }
                    : undefined;
            await this.events.assertCanVote(dto.eventId, userId, position);
            await this.trackVote.castVote(dto.eventId, userId, dto.trackId);
        } catch (err) {
            client.emit('vote:error', { message: err instanceof Error ? err.message : 'Vote failed' });
            return;
        }
        await this.broadcastBoard(dto.eventId);
    }

    @SubscribeMessage('vote:retract')
    async onRetractVote(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: { eventId: number; trackId: number; latitude?: number; longitude?: number },
    ) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            const position =
                dto.latitude != null && dto.longitude != null
                    ? { latitude: dto.latitude, longitude: dto.longitude }
                    : undefined;
            await this.events.assertCanVote(dto.eventId, userId, position);
            await this.trackVote.retractVote(dto.eventId, userId, dto.trackId);
        } catch (err) {
            client.emit('vote:error', { message: err instanceof Error ? err.message : 'Vote failed' });
            return;
        }
        await this.broadcastBoard(dto.eventId);
    }

    /**
     * Chaque participant a son propre "myVote" par morceau : on ne peut donc
     * pas diffuser un board unique a toute la room (ca ecraserait le myVote de
     * chacun avec une version publique). On recalcule un board personnalise
     * par socket connecte a la room.
     */
    async broadcastBoard(eventId: number) {
        const room = eventRoomOf(eventId);
        const sockets = await this.server.in(room).fetchSockets();
        let lastBoard: Board | null = null;
        await Promise.all(
            sockets.map(async (socket) => {
                const userId = (socket.data as { userId?: number })?.userId;
                if (!userId) return;
                const board = await this.trackVote.getBoard(eventId, userId);
                lastBoard = board;
                socket.emit('vote:board', board);
            }),
        );
        if (sockets.length > 0 && lastBoard) this.scheduleTick(eventId, lastBoard);
        else this.clearTick(eventId);
    }

    /**
     * Arme un minuteur pour rejouer broadcastBoard() a la fin du morceau en
     * cours : ca provoque un nouvel appel a getBoard/ensureAdvanced cote
     * service, qui fait avancer la file toute seule et renvoie le resultat a
     * la room. Idempotent : un nouvel appel remplace le minuteur precedent
     * plutot que d'en empiler plusieurs.
     */
    private scheduleTick(eventId: number, board: Board) {
        this.clearTick(eventId);
        if (!board.nowPlaying) return;

        const remaining = board.nowPlaying.startedAt + board.nowPlaying.durationMs - Date.now();
        const delay = Math.max(remaining, 0) + 500;
        const timer = setTimeout(() => {
            this.tickers.delete(eventId);
            this.broadcastBoard(eventId).catch((err) => this.logger.error(err));
        }, delay);
        this.tickers.set(eventId, timer);
    }

    private clearTick(eventId: number) {
        const existing = this.tickers.get(eventId);
        if (existing) {
            clearTimeout(existing);
            this.tickers.delete(eventId);
        }
    }

    private extractToken(client: Socket): string | null {
        const fromAuth = client.handshake.auth?.token;
        if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
        const header = client.handshake.headers?.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
        return null;
    }
}
