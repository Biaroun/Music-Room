import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Playlist } from './playlist.entity';

// one track inside a playlist (or inside an event queue for track vote)
@Entity()
export class PlaylistTrack {
    @PrimaryGeneratedColumn()
    id: number;

    // id du morceau chez deezer, pas id de cette ligne
    @Column()
    deezerId: string;

    @Column()
    title: string;

    @Column()
    artist: string;

    @Column({ nullable: true })
    artistId: string;

    @Column({ nullable: true })
    cover: string;

    // 30s mp3 preview from deezer
    @Column()
    previewUrl: string;

    // deezer renvoie le bpm en float
    @Column({ type: 'float', nullable: true })
    bpm: number | null;

    // ordre d'affichage, 0-based
    @Column({ type: 'int' })
    position: number;

    @ManyToOne(() => Playlist, (playlist) => playlist.tracks, { onDelete: 'CASCADE' })
    playlist: Playlist;

    @CreateDateColumn()
    addedAt: Date;

    // track-vote uniquement : marque un morceau deja joue pour qu'il sorte du
    // classement votable. null cote playlist-editor
    @Column({ type: 'timestamp', nullable: true })
    playedAt: Date | null;
}
