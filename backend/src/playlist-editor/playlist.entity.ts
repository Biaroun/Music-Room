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
