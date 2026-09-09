import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';

// invitation a sens unique : pas de negociation accepte/refuse comme pour
// Friendship, la ligne suffit a donner l'acces
@Entity()
@Unique(['event', 'invitee'])
export class EventInvite {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Event, { onDelete: 'CASCADE' })
    @JoinColumn()
    event: Event;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    invitee: User;

    @CreateDateColumn()
    createdAt: Date;
}
