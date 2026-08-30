import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Playlist } from '../playlist-editor/playlist.entity';

export enum EventVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private',
}

export enum EventLicenseMode {
    OPEN = 'open',
    INVITE_ONLY = 'invite-only',
    GEO_TIME_RESTRICTED = 'geo-time-restricted',
}

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

    // Uniquement renseignes quand licenseMode = GEO_TIME_RESTRICTED
    @Column({ type: 'float', nullable: true })
    licenseLatitude: number | null;

    @Column({ type: 'float', nullable: true })
    licenseLongitude: number | null;

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
