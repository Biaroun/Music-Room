import { ConflictException, Inject, Logger } from '@nestjs/common';
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
import { PlaylistEditorService } from './playlist-editor.service';
import { AddTrackDto } from './dto/add-track.dto';

type AuthedSocket = Socket & { data: { userId: number; username: string } };

export function playlistRoomOf(playlistId: number): string {
    return `playlist:${playlistId}`;
}

/**
 * Meme namespace '/realtime' que ListeningGateway et TrackVoteGateway : un seul
 * socket cote mobile pour l'ecoute, le vote et l'edition. Une room par playlist,
 * tous ses editeurs recoivent le meme etat.
 * REST reste la source de verite / le repli (voir PlaylistEditorController) ;
 * ce gateway ne fait que pousser l'etat a la room.
 */
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
        const token = this.extractToken(client);
        if (!token) return client.disconnect(true);

        try {
            const payload = await this.jwt.verifyAsync<{ sub: number; username: string }>(token, {
                secret: this.config.get<string>('JWT_SECRET'),
            });
            // meme liste noire que JwtStrategy : un token revoque ne doit pas
            // pouvoir ouvrir un socket alors qu'il est refuse en HTTP
            if (await this.cache.get(`blacklist:${token}`)) return client.disconnect(true);

            client.data.userId = payload.sub;
            client.data.username = payload.username;
        } catch {
            client.disconnect(true);
        }
    }

    @SubscribeMessage('playlist:join')
    async onJoin(@ConnectedSocket() client: AuthedSocket, @MessageBody() dto: { playlistId: number }) {
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.playlists.assertCanView(dto.playlistId, userId);
        } catch {
            client.emit('playlist:error', { message: 'Cannot open this playlist' });
            return;
        }
        await client.join(playlistRoomOf(dto.playlistId));
        // snapshot immediat : le joiner n'attend pas l'edition de quelqu'un d'autre
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
        const userId = client.data?.userId;
        if (!userId) return;
        // playlistId retire du reste : il adresse la room, ce n'est pas une
        // colonne de PlaylistTrack.
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
        const userId = client.data?.userId;
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
        const userId = client.data?.userId;
        if (!userId) return;
        try {
            await this.playlists.reorder(dto.playlistId, userId, dto.trackIds, dto.version);
        } catch (err) {
            // Conflit d'edition concurrente : on renvoie l'etat frais a
            // l'emetteur seul, pour qu'il adopte l'ordre du serveur au lieu de
            // deviner. Les autres n'ont rien a reafficher, rien n'a change.
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
     * Un etat de playlist est identique pour tous ses spectateurs, contrairement
     * au board de track-vote qui porte un myVote par utilisateur : une seule
     * lecture et un seul emit suffisent, pas de boucle sur fetchSockets().
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
