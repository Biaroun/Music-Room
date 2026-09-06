import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { PlaylistTrack } from './playlist-track.entity';

@Entity()
export class Playlist {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ default: true })
    isPublic: boolean;

    // Incremente a la main par chaque mutation de contenu. @VersionColumn ne
    // conviendrait pas : add/removeTrack sauvegardent un PlaylistTrack, jamais
    // la Playlist, donc la version ne bougerait pas.
    @Column({ type: 'int', default: 0 })
    version: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    owner: User;

    @OneToMany(() => PlaylistTrack, (track) => track.playlist, { cascade: true })
    tracks: PlaylistTrack[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
