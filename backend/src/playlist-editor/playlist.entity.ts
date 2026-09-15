import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { PlaylistTrack } from './playlist-track.entity';

// sujet v.2.3 : par defaut tout le monde edite, sous licence invite-only seuls
// les invites editent. axe distinct de isPublic, qui ne regle que la lecture
export enum PlaylistLicenseMode {
    OPEN = 'open',
    INVITE_ONLY = 'invite-only',
}

// a playlist (owner tracks visibility and license)
@Entity()
export class Playlist {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    // public = everybody can see it (edit depend on licenseMode)
    @Column({ default: true })
    isPublic: boolean;

    @Column({ type: 'enum', enum: PlaylistLicenseMode, default: PlaylistLicenseMode.OPEN })
    licenseMode: PlaylistLicenseMode;

    // incremente a la main a chaque mutation. @VersionColumn ne marcherait pas :
    // add/removeTrack sauvegardent un PlaylistTrack, jamais la Playlist
    @Column({ type: 'int', default: 0 })
    version: number;

    // owner deleted = playlist deleted too
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
