import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Playlist } from './playlist.entity';

@Entity()
export class PlaylistTrack {
    @PrimaryGeneratedColumn()
    id: number;

    // l'id du morceau chez Deezer, pas l'id de cette ligne
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

    @Column()
    previewUrl: string;

    // deezer renvoie le bpm en float (ex: 118.6)
    @Column({ type: 'float', nullable: true })
    bpm: number | null;

    // ordre d'affichage dans la playlist, 0-based
    @Column({ type: 'int' })
    position: number;

    @ManyToOne(() => Playlist, (playlist) => playlist.tracks, { onDelete: 'CASCADE' })
    playlist: Playlist;

    @CreateDateColumn()
    addedAt: Date;

    // Usage track-vote uniquement : marque un morceau comme deja joue dans la
    // file d'attente d'un event, pour qu'il sorte du classement votable et ne
    // repasse jamais. Reste null pour l'usage playlist-editor classique.
    @Column({ type: 'timestamp', nullable: true })
    playedAt: Date | null;
}
