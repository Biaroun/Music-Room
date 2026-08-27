import { Logger } from '@nestjs/common';
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
import { ListeningService } from './listening.service';
import { UpdateListeningDto } from './dto/update-listening.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };

function roomOf(userId: number): string {
    return `user:${userId}`;
}

/**
 * Couche temps réel de l'écoute en cours.
 *
 * Le REST (ListeningController) reste la source pour le premier chargement et sert de
 * repli si le socket ne passe pas ; le socket ne fait que pousser les changements.
 * Une même personne peut être connectée depuis plusieurs appareils : on raisonne donc
 * en "room par utilisateur" et pas en socket unique.
 */
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
        const token = this.extractToken(client);
        if (!token) return client.disconnect(true);

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; username: string }>(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });
            // même liste noire que JwtStrategy : un token révoqué ne doit pas
            // pouvoir ouvrir un socket alors qu'il est refusé en HTTP
            if (await this.cache.get(`blacklist:${token}`)) return client.disconnect(true);

            client.data.userId = payload.sub;
            client.data.username = payload.username;
            await client.join(roomOf(payload.sub));

            // état initial, pour ne pas attendre le premier changement d'un ami
            client.emit('listening:snapshot', await this.listening.getFriendsListening(payload.sub));
        } catch {
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: AuthedSocket) {
        const userId = client.data?.userId;
        if (!userId) return;

        // Un autre appareil du même utilisateur peut encore écouter : on ne coupe
        // l'écoute que quand sa dernière connexion s'en va.
        const remaining = await this.server.in(roomOf(userId)).fetchSockets();
        if (remaining.length > 0) return;

        await this.listening.clear(userId);
        await this.broadcastStopped(userId);
    }

    @SubscribeMessage('listening:update')
    async onUpdate(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: UpdateListeningDto) {
        const userId = client.data?.userId;
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
        const userId = client.data?.userId;
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
