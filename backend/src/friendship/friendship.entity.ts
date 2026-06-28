import {Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {User} from "../users/user.entity";

export enum FriendshipStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    BLOCKED = 'blocked',
}


@Entity()
export class Friendship {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    requester: User;

    @ManyToOne(() => User)
    receiver: User;

    @Column({ type: 'enum', enum: FriendshipStatus, default: FriendshipStatus.PENDING })
    status: FriendshipStatus;

    @CreateDateColumn()
    createdAt: Date;
}