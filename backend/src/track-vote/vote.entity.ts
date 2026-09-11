import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';
import { PlaylistTrack } from '../playlist-editor/playlist-track.entity';

// un voter peut voter pour plusieurs morceaux d'un event mais une seule fois
// chacun, d'ou la contrainte unique sur (event, voter, track) et pas seulement
// (event, voter). c'est elle qui rend le vote atomique via
// insert ... on conflict do nothing, plutot qu'un compteur lu puis ecrit
@Entity()
@Unique(['event', 'voter', 'track'])
export class Vote {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn()
    event: Event;

    @ManyToOne(() => PlaylistTrack, { onDelete: 'CASCADE' })
    @JoinColumn()
    track: PlaylistTrack;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    voter: User;

    @CreateDateColumn()
    createdAt: Date;
}
