import { Logger, UseInterceptors } from '@nestjs/common';
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
import { LogsInterceptor } from '../logs/logs.interceptor';
import { EventService } from './event.service';
import { Board, TrackVoteService } from './track-vote.service';
import { CastVoteDto } from './dto/cast-vote.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };
type Timer = ReturnType<typeof setTimeout>;

export function eventRoomOf(eventId: number): string {
    return `event:${eventId}`;
}

/**
 * namespace '/realtime' partage avec ListeningGateway : un seul socket cote
 * mobile pour l'ecoute et le vote. rooms par event et pas par utilisateur,
 * tous les participants recoivent le meme board.
 * rest reste la source de verite et le repli (voir TrackVoteController), ce
 * gateway ne fait que pousser les recalculs de board.
 */
// log v.6 branche a la main : @nestjs/websockets construit son
// InterceptorsContextCreator sans l'ApplicationConfig, donc un APP_INTERCEPTOR
// n'atteint jamais un @SubscribeMessage
@UseInterceptors(LogsInterceptor)
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class TrackVoteGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(TrackVoteGateway.name);
    // un minuteur par event, arme sur la fin du morceau en cours : c'est lui
    // qui fait avancer la file sans attendre qu'un client rafraichisse.
    // s'eteint des que la room est vide
    private tickers = new Map<number, Timer>();

    constructor(
        private events: EventService,
        private trackVote: TrackVoteService,
        private jwt: JwtService,
        private config: ConfigService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    async handleConnection(client: AuthedSocket) {
        if (!(await this.authenticate(client))) client.disconnect(true);
    }

    /** pose userId/username sur le socket, null si le token manque ou est revoque */
    private async authenticate(client: AuthedSocket): Promise<number | null> {
        const token = this.extractToken(client);
        if (!token) return null;

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; username: string }>(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });
            // meme liste noire que JwtStrategy : un token revoque en http ne
            // doit pas pouvoir ouvrir un socket
            if (await this.cache.get(`blacklist:${token}`)) return null;

            client.data.userId = payload.sub;
            client.data.username = payload.username;
            return payload.sub;
        } catch {
            return null;
        }
    }

    /**
     * handleConnection est asynchrone alors que 'connect' part cote client des
     * que la connexion est etablie : un message emis dans la foulee arrive
     * avant l'auth. lire client.data.userId seul le jetait en silence, d'ou le
     * rejeu de l'auth ici. meme correctif que PlaylistEditorGateway.
     */
    private resolveUserId(client: AuthedSocket): Promise<number | null> {
        if (client.data?.userId) return Promise.resolve(client.data.userId);
        return this.authenticate(client);
    }

    @SubscribeMessage('event:join')
    async onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { eventId: number }) {
        const userId = await this.resolveUserId(client);
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
        const userId = await this.resolveUserId(client);
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
        const userId = await this.resolveUserId(client);
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
     * chaque participant a son propre myVote par morceau : un board unique
     * diffuse a la room ecraserait celui de chacun par une version publique.
     * d'ou un board recalcule par socket.
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
     * arme un minuteur qui rejoue broadcastBoard() a la fin du morceau : le
     * getBoard/ensureAdvanced qui suit fait avancer la file tout seul.
     * idempotent, un nouvel appel remplace le minuteur au lieu d'en empiler.
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
