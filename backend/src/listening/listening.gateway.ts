import { Logger, UseInterceptors } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LogsInterceptor } from '../logs/logs.interceptor';
import { ListeningService } from './listening.service';
import { UpdateListeningDto } from './dto/update-listening.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };

function roomOf(userId: number): string {
    return `user:${userId}`;
}

/**
 * couche temps reel de l'ecoute en cours.
 *
 * rest (ListeningController) reste la source du premier chargement et le repli
 * si le socket ne passe pas, le socket ne fait que pousser les changements.
 * une meme personne peut etre connectee depuis plusieurs appareils, d'ou une
 * room par utilisateur plutot qu'un socket unique.
 */
// log v.6 branche a la main : @nestjs/websockets construit son
// InterceptorsContextCreator sans l'ApplicationConfig, donc un APP_INTERCEPTOR
// n'atteint jamais un @SubscribeMessage
@UseInterceptors(LogsInterceptor)
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class ListeningGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(ListeningGateway.name);

    constructor(
        private listening: ListeningService,
        private jwt: JwtService,
        private config: ConfigService,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {}

    async handleConnection(client: AuthedSocket) {
        const userId = await this.authenticate(client);
        if (!userId) return client.disconnect(true);

        await client.join(roomOf(userId));
        // etat initial, pour ne pas attendre le premier changement d'un ami
        client.emit('listening:snapshot', await this.listening.getFriendsListening(userId));
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
     * que la connexion est etablie : un listening:update emis dans la foulee
     * arrive avant l'auth et etait jete en silence. meme correctif que
     * PlaylistEditorGateway.
     */
    private resolveUserId(client: AuthedSocket): Promise<number | null> {
        if (client.data?.userId) return Promise.resolve(client.data.userId);
        return this.authenticate(client);
    }

    async handleDisconnect(client: AuthedSocket) {
        const userId = client.data?.userId;
        if (!userId) return;

        // un autre appareil du meme utilisateur peut encore ecouter : on ne
        // coupe qu'au depart de la derniere connexion
        const remaining = await this.server.in(roomOf(userId)).fetchSockets();
        if (remaining.length > 0) return;

        await this.listening.clear(userId);
        await this.broadcastStopped(userId);
    }

    @SubscribeMessage('listening:update')
    async onUpdate(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: UpdateListeningDto) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;

        const entry = await this.listening.set(userId, dto);
        const { me, friendIds } = await this.listening.getAudience(userId);
        const payload = {
            ...entry,
            username: me?.username ?? client.data.username,
            avatar: me?.avatar ?? null,
        };
        for (const friendId of friendIds) {
            this.server.to(roomOf(friendId)).emit('listening:changed', payload);
        }
    }

    @SubscribeMessage('listening:stop')
    async onStop(@ConnectedSocket() client: AuthedSocket) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;
        await this.listening.clear(userId);
        await this.broadcastStopped(userId);
    }

    private async broadcastStopped(userId: number) {
        const { friendIds } = await this.listening.getAudience(userId);
        for (const friendId of friendIds) {
            this.server.to(roomOf(friendId)).emit('listening:stopped', { userId });
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
