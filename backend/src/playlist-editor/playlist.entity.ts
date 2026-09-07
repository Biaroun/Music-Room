import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { PlaylistTrack } from './playlist-track.entity';

// Sujet V.2.3 : "By default, everyone can edit the playlist" / "With the right
// license, the invited users are the only ones who can edit". Axe distinct de
// isPublic, qui ne regle que l'acces en lecture (meme separation que Event).
export enum PlaylistLicenseMode {
    OPEN = 'open',
    INVITE_ONLY = 'invite-only',
}

@Entity()
export class Playlist {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ default: true })
    isPublic: boolean;

    @Column({ type: 'enum', enum: PlaylistLicenseMode, default: PlaylistLicenseMode.OPEN })
    licenseMode: PlaylistLicenseMode;

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
