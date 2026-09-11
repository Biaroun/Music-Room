import { ConflictException, Inject, Logger, UseInterceptors } from '@nestjs/common';
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
import { PlaylistEditorService } from './playlist-editor.service';
import { AddTrackDto } from './dto/add-track.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };

export function playlistRoomOf(playlistId: number): string {
    return `playlist:${playlistId}`;
}

/**
 * namespace '/realtime' partage avec ListeningGateway et TrackVoteGateway : un
 * seul socket cote mobile pour l'ecoute, le vote et l'edition. une room par
 * playlist, tous ses editeurs recoivent le meme etat.
 * rest reste la source de verite et le repli (voir PlaylistEditorController),
 * ce gateway ne fait que pousser l'etat a la room.
 */
// log v.6 branche a la main : @nestjs/websockets construit son
// InterceptorsContextCreator sans l'ApplicationConfig, donc un APP_INTERCEPTOR
// n'atteint jamais un @SubscribeMessage
@UseInterceptors(LogsInterceptor)
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class PlaylistEditorGateway implements OnGatewayConnection {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(PlaylistEditorGateway.name);

    constructor(
        private playlists: PlaylistEditorService,
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
     * rejeu de l'auth ici.
     */
    private resolveUserId(client: AuthedSocket): Promise<number | null> {
        if (client.data?.userId) return Promise.resolve(client.data.userId);
        return this.authenticate(client);
    }

    @SubscribeMessage('playlist:join')
    async onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { playlistId: number }) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;
        try {
            await this.playlists.assertCanView(dto.playlistId, userId);
        } catch {
            client.emit('playlist:error', { message: 'Cannot open this playlist' });
            return;
        }
        await client.join(playlistRoomOf(dto.playlistId));
        // snapshot immediat : le joiner n'attend pas l'edition d'un autre
        client.emit('playlist:state', await this.playlists.getState(dto.playlistId));
    }

    @SubscribeMessage('playlist:leave')
    async onLeave(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { playlistId: number }) {
        await client.leave(playlistRoomOf(dto.playlistId));
    }

    @SubscribeMessage('playlist:track:add')
    async onAddTrack(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: AddTrackDto & { playlistId: number },
    ) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;
        // playlistId adresse la room, ce n'est pas une colonne de PlaylistTrack
        const { playlistId, ...track } = dto;
        try {
            await this.playlists.addTrack(playlistId, userId, track);
        } catch (err) {
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to add track' });
            return;
        }
        await this.broadcastState(playlistId);
    }

    @SubscribeMessage('playlist:track:remove')
    async onRemoveTrack(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: { playlistId: number; trackId: number },
    ) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;
        try {
            await this.playlists.removeTrack(dto.playlistId, dto.trackId, userId);
        } catch (err) {
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to remove track' });
            return;
        }
        await this.broadcastState(dto.playlistId);
    }

    @SubscribeMessage('playlist:reorder')
    async onReorder(
        @ConnectedSocket() client: AuthedSocket,
        @MessageBody() dto: { playlistId: number; trackIds: number[]; version?: number },
    ) {
        const userId = await this.resolveUserId(client);
        if (!userId) return;
        try {
            await this.playlists.reorder(dto.playlistId, userId, dto.trackIds, dto.version);
        } catch (err) {
            // edition concurrente : l'etat frais part au seul emetteur, pour
            // qu'il adopte l'ordre du serveur. les autres n'ont rien a
            // reafficher, rien n'a change
            if (err instanceof ConflictException) {
                client.emit('playlist:conflict', {
                    message: err.message,
                    state: await this.playlists.getState(dto.playlistId),
                });
                return;
            }
            client.emit('playlist:error', { message: err instanceof Error ? err.message : 'Failed to reorder' });
            return;
        }
        await this.broadcastState(dto.playlistId);
    }

    /**
     * l'etat est le meme pour tous les spectateurs, contrairement au board de
     * track-vote qui porte un myVote par utilisateur : une lecture et un emit
     * suffisent, pas de boucle sur fetchSockets().
     */
    async broadcastState(playlistId: number) {
        const state = await this.playlists.getState(playlistId);
        this.server.to(playlistRoomOf(playlistId)).emit('playlist:state', state);
    }

    private extractToken(client: Socket): string | null {
        const fromAuth = client.handshake.auth?.token;
        if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
        const header = client.handshake.headers?.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
        return null;
    }
}
