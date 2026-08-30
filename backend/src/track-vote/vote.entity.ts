import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';
import { PlaylistTrack } from '../playlist-editor/playlist-track.entity';

// Un voter peut voter pour plusieurs morceaux differents d'un meme event, mais
// une seule fois chacun : la contrainte unique porte sur (event, voter, track),
// pas seulement (event, voter). C'est elle qui rend le vote atomique
// (INSERT ... ON CONFLICT DO NOTHING), jamais un compteur lu-puis-ecrit qui
// pourrait perdre une mise a jour concurrente.
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
