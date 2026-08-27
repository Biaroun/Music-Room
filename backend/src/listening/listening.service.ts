import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UpdateListeningDto } from './dto/update-listening.dto';
import { FriendshipService } from '../friendship/friendship.service';
import { LISTENING_VISIBILITY_DEFAULT, User, Visibility } from '../users/user.entity';

export type NowPlaying = {
    userId: number;
    deezerId: string;
    title: string;
    artist: string;
    cover: string | null;
    startedAt: number;
};

// Ce qu'on renvoie au client : l'écoute enrichie de qui écoute.
export type FriendListening = NowPlaying & {
    username: string;
    avatar: string | null;
};

// L'écoute en cours est un état transitoire : on la garde dans le cache Redis
// (déjà branché via CacheModule) et pas en base.
// Le TTL fait tout le travail de péremption : si le client cesse d'envoyer son
// heartbeat (app fermée, réseau coupé, onglet tué), la clé disparaît d'elle-même
// et l'utilisateur repasse en "aucune écoute". Aucun cron de nettoyage à maintenir.
export const NOW_PLAYING_TTL_MS = 120_000;
// Volontairement bien en dessous du TTL : un heartbeat perdu ne doit pas
// faire disparaître l'écoute.
export const HEARTBEAT_INTERVAL_MS = 45_000;

@Injectable()
export class ListeningService {
    constructor(
        @Inject(CACHE_MANAGER) private cache: Cache,
        private friendship: FriendshipService,
    ) {}

    private key(userId: number): string {
        return `nowplaying:${userId}`;
    }

    async set(userId: number, dto: UpdateListeningDto): Promise<NowPlaying> {
        const existing = await this.get(userId);
        const entry: NowPlaying = {
            userId,
            deezerId: dto.deezerId,
            title: dto.title,
            artist: dto.artist,
            cover: dto.cover ?? null,
            // même morceau qu'avant = simple heartbeat, on ne remet pas le compteur à zéro
            startedAt: existing?.deezerId === dto.deezerId ? existing.startedAt : Date.now(),
        };
        await this.cache.set(this.key(userId), entry, NOW_PLAYING_TTL_MS);
        return entry;
    }

    async clear(userId: number): Promise<void> {
        await this.cache.del(this.key(userId));
    }

    async get(userId: number): Promise<NowPlaying | null> {
        return (await this.cache.get<NowPlaying>(this.key(userId))) ?? null;
    }

    async getMany(userIds: number[]): Promise<NowPlaying[]> {
        const entries = await Promise.all(userIds.map((id) => this.get(id)));
        return entries.filter((e): e is NowPlaying => e !== null);
    }

    private listeningVisibility(user: User): Visibility {
        return user.visibilitySettings?.listening ?? LISTENING_VISIBILITY_DEFAULT;
    }

    // getFriends renvoie les relations avec les deux User chargés : on y lit d'un coup
    // la liste des amis ET notre propre profil, sans dépendance vers UsersService.
    private async socialGraph(userId: number): Promise<{ me: User | null; friends: User[] }> {
        const relations = await this.friendship.getFriends(userId);
        let me: User | null = null;
        const friends = relations.map((relation) => {
            const iAmRequester = relation.requester.id === userId;
            me ??= iAmRequester ? relation.requester : relation.receiver;
            return iAmRequester ? relation.receiver : relation.requester;
        });
        return { me, friends };
    }

    /**
     * Qui doit recevoir MON écoute, et mon propre profil pour composer le message.
     * friendIds est vide si je me suis mis en privé.
     */
    async getAudience(userId: number): Promise<{ me: User | null; friendIds: number[] }> {
        const { me, friends } = await this.socialGraph(userId);
        if (me && this.listeningVisibility(me) === Visibility.PRIVATE)
            return { me, friendIds: [] };
        return { me, friendIds: friends.map((f) => f.id) };
    }

    /** Écoutes en cours des amis qui acceptent de me les montrer. */
    async getFriendsListening(userId: number): Promise<FriendListening[]> {
        const { friends } = await this.socialGraph(userId);
        const visible = friends.filter((f) => this.listeningVisibility(f) !== Visibility.PRIVATE);

        const entries = await Promise.all(
            visible.map(async (friend) => {
                const playing = await this.get(friend.id);
                if (!playing) return null;
                return { ...playing, username: friend.username, avatar: friend.avatar };
            }),
        );
        return entries.filter((e): e is FriendListening => e !== null);
    }
}
