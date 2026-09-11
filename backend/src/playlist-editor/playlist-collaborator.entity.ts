import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Playlist } from './playlist.entity';

// meme forme que EventInvite : invitation a sens unique, la ligne suffit a
// donner le droit d'edition
@Entity()
@Unique(['playlist', 'collaborator'])
export class PlaylistCollaborator {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Playlist, { onDelete: 'CASCADE' })
    @JoinColumn()
    playlist: Playlist;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn()
    collaborator: User;

    @CreateDateColumn()
    createdAt: Date;
}
