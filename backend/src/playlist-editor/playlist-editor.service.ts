import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from './playlist.entity';
import { PlaylistTrack } from './playlist-track.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackDto } from './dto/add-track.dto';

@Injectable()
export class PlaylistEditorService {
    constructor(
        @InjectRepository(Playlist) private playlists: Repository<Playlist>,
        @InjectRepository(PlaylistTrack) private tracks: Repository<PlaylistTrack>,
    ) {}

    async create(ownerId: number, dto: CreatePlaylistDto) {
        const playlist = this.playlists.create({
            name: dto.name,
            isPublic: dto.isPublic ?? true,
            owner: { id: ownerId } as any,
        });
        return this.playlists.save(playlist);
    }

    findMine(ownerId: number) {
        // tracks charge juste pour le compteur affiche dans la liste cote mobile
        return this.playlists.find({
            where: { owner: { id: ownerId } },
            relations: { tracks: true },
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: number, requesterId: number) {
        // select restreint sur owner : sinon TypeORM renvoie tout l'entity User avec les
        // relations, tokens de reset/verif compris.
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true, tracks: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        if (!playlist.isPublic && playlist.owner.id !== requesterId) {
            throw new ForbiddenException('This playlist is private');
        }
        playlist.tracks.sort((a, b) => a.position - b.position);
        return playlist;
    }

    private async findOwned(id: number, ownerId: number): Promise<Playlist> {
        const playlist = await this.playlists.findOne({
            where: { id },
            relations: { owner: true },
            select: { owner: { id: true, username: true } },
        });
        if (!playlist) throw new NotFoundException('Playlist not found');
        if (playlist.owner.id !== ownerId) throw new ForbiddenException('Not your playlist');
        return playlist;
    }

    async update(id: number, ownerId: number, dto: UpdatePlaylistDto) {
        const playlist = await this.findOwned(id, ownerId);
        Object.assign(playlist, dto);
        return this.playlists.save(playlist);
    }

    async remove(id: number, ownerId: number): Promise<void> {
        const playlist = await this.findOwned(id, ownerId);
        await this.playlists.remove(playlist);
    }

    async addTrack(playlistId: number, ownerId: number, dto: AddTrackDto) {
        const playlist = await this.findOwned(playlistId, ownerId);
        const position = await this.tracks.count({ where: { playlist: { id: playlist.id } } });
        // juste l'id pour la relation, pas besoin de renvoyer la playlist entiere dans la reponse
        const track = this.tracks.create({ ...dto, position, playlist: { id: playlist.id } as any });
        return this.tracks.save(track);
    }

    async removeTrack(playlistId: number, trackId: number, ownerId: number): Promise<void> {
        await this.findOwned(playlistId, ownerId);
        const track = await this.tracks.findOne({ where: { id: trackId, playlist: { id: playlistId } } });
        if (!track) throw new NotFoundException('Track not found in this playlist');
        await this.tracks.remove(track);
    }

    async reorder(playlistId: number, ownerId: number, trackIds: number[]) {
        await this.findOwned(playlistId, ownerId);
        const currentTracks = await this.tracks.find({ where: { playlist: { id: playlistId } } });

        const currentIds = currentTracks.map((t) => t.id).sort((a, b) => a - b);
        const requestedIds = [...trackIds].sort((a, b) => a - b);
        const sameSet = currentIds.length === requestedIds.length && currentIds.every((id, i) => id === requestedIds[i]);
        if (!sameSet) {
            throw new ForbiddenException('trackIds must match exactly the tracks currently in the playlist');
        }

        await Promise.all(trackIds.map((trackId, index) => this.tracks.update(trackId, { position: index })));
        return this.findOne(playlistId, ownerId);
    }
}
