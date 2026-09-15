import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Playlist } from '../playlist-editor/playlist.entity';

// who can see the event
export enum EventVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
}

// who can vote (everybody invited only or in a zone and a time window)
export enum EventLicenseMode {
    OPEN = 'open',
    INVITE_ONLY = 'invite-only',
    GEO_TIME_RESTRICTED = 'geo-time-restricted',
}

// a track vote event built on a playlist
@Entity()
export class Event {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
    @JoinColumn()
    playlist: Playlist;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    owner: User;

    @Column({ type: 'enum', enum: EventVisibility, default: EventVisibility.PUBLIC })
    visibility: EventVisibility;

    @Column({ type: 'enum', enum: EventLicenseMode, default: EventLicenseMode.OPEN })
    licenseMode: EventLicenseMode;

    // renseignes uniquement quand licenseMode vaut GEO_TIME_RESTRICTED
    @Column({ type: 'float', nullable: true })
    licenseLatitude: number | null;

    @Column({ type: 'float', nullable: true })
    licenseLongitude: number | null;

    // radius around the lat lng in meters
    @Column({ type: 'int', nullable: true })
    licenseRadiusMeters: number | null;

    @Column({ type: 'timestamp', nullable: true })
    licenseStartsAt: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    licenseEndsAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
