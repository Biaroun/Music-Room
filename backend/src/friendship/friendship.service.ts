import {ConflictException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Friendship, FriendshipStatus} from "./friendship.entity";
import {User} from "../users/user.entity";

// all the friend logic (requests friends blocks)
@Injectable()
export class FriendshipService {

    constructor(
        @InjectRepository(Friendship)
        private friendshipRepository: Repository<Friendship>
    ) {}

    // find any relation between A and B (in both directions any status)
    async isFriendshipExist(userAId: number, userBId: number): Promise<Friendship | null> {
        return await this.friendshipRepository.findOne({
            where: [
                { requester: { id: userAId }, receiver: { id: userBId } },
                { requester: { id: userBId }, receiver: { id: userAId } },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    // true only if the relation is accepted
    async areFriends(userAId: number, userBId: number): Promise<boolean> {
        const relation = await this.friendshipRepository.findOne({
            where: [
                { requester: { id: userAId }, receiver: { id: userBId }, status: FriendshipStatus.ACCEPTED },
                { requester: { id: userBId }, receiver: { id: userAId }, status: FriendshipStatus.ACCEPTED },
            ],
        });
        return !!relation;
    }
    // same as isFriendshipExist but with a given status
    async isRelationExist(userAId: number, userBId: number, status: FriendshipStatus): Promise<Friendship | null> {
        return await this.friendshipRepository.findOne({
            where: [
                { requester: { id: userAId }, receiver: { id: userBId }, status : status },
                { requester: { id: userBId }, receiver: { id: userAId }, status : status  },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    // send a request (or accept it if the other one already asked me)
    async sendRequest(requesterId: number, receiverId: number): Promise<Friendship> {

        let relation = await this.isFriendshipExist(requesterId, receiverId);

        if (relation) {
            if (relation.status === FriendshipStatus.BLOCKED)
                throw new ForbiddenException('A block exists between you and this user');

            if (relation.status === FriendshipStatus.ACCEPTED) {
                throw new ConflictException('You are already friends');
            }

            if (relation.status === FriendshipStatus.PENDING ) {
                // im not the receiver = I already sent it (sinon cross request = auto accept)
                if (requesterId !== relation.receiver.id)
                    throw new ConflictException('Friend request already sent');
                else
                    relation.status = FriendshipStatus.ACCEPTED;
            }
        } else {
            relation = this.friendshipRepository.create({
                requester: { id: requesterId } as User,
                receiver: { id: receiverId } as User,
            });
        }

        await this.friendshipRepository.save(relation);

        // reload with the relations (save dont give back the users)
        const saved = await this.friendshipRepository.findOne({
            where: { id: relation.id },
            relations: ['requester', 'receiver'],
        });

        if (!saved) {
            throw new NotFoundException('Friendship not found after save');
        }

        return saved;
    }

    // accept a pending request (only the receiver can)
    async acceptRequest(requestId: number, receiverId: number): Promise<Friendship> {
        const relation = await this.friendshipRepository.findOne({
            where: { id: requestId, receiver: { id: receiverId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });

        if (!relation) {
            throw new NotFoundException('Request didnt exist');
        }
        relation.status = FriendshipStatus.ACCEPTED;
        return await this.friendshipRepository.save(relation);

    }

    // reject = delete the pending request
    async rejectRequest(requestId: number, receiverId: number): Promise<void> {
        const relation = await this.friendshipRepository.findOne({
            where: { id: requestId, receiver: { id: receiverId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });

        if (!relation) {
            throw new NotFoundException('Request didnt exist');
        }
        await this.friendshipRepository.delete(relation.id);
        return;
    }

    // the pending requests I sent
    async getSentPendingRequests(requesterId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: { requester: { id: requesterId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });
    }

    // cancel a request I sent (delete it)
    async cancelSentRequest(requestId: number, requesterId: number): Promise<void> {
        const relation = await this.friendshipRepository.findOne({
            where: { id: requestId, requester: { id: requesterId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });

        if (!relation) {
            throw new NotFoundException('Request didnt exist');
        }
        await this.friendshipRepository.delete(relation.id);
        return;
    }

    // the pending requests I received
    async getPendingRequests(receiverId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: { receiver: { id: receiverId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });
    }

    // all the accepted relations where im on one side
    async getFriends(userId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: [
                { requester: { id: userId }, status: FriendshipStatus.ACCEPTED },
                { receiver: { id: userId }, status: FriendshipStatus.ACCEPTED },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    // the blocks I did AND the ones against me
    async getBlocks(userId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: [
                { requester: { id: userId }, status: FriendshipStatus.BLOCKED },
                { receiver: { id: userId }, status: FriendshipStatus.BLOCKED },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    // block a user (on remplace the old relation by a blocked one)
    async blockUser(blockerId: number, targetId: number): Promise<Friendship> {
        const isblocked = await this.friendshipRepository.findOne({
            where: {
                requester: { id: targetId },
                receiver: { id: blockerId },
                status: FriendshipStatus.BLOCKED
            }
        });

        // if the target already blocked me we keep that block (sinon we delete the old relation)
        if (!isblocked) {
            const relation = await this.isFriendshipExist(blockerId, targetId);

            if (relation) {
                await this.friendshipRepository.delete(relation.id);
            }
        }

        const block = this.friendshipRepository.create({
            requester: { id: blockerId } as User,
            receiver: { id: targetId } as User,
            status: FriendshipStatus.BLOCKED
        });

        await this.friendshipRepository.save(block);

        const saved = await this.friendshipRepository.findOne({
            where: { id: block.id },
            relations: ['requester', 'receiver'],
        });

        if (!saved) {
            throw new NotFoundException('Block not found after save');
        }

        return saved;
    }

    // remove a block (only the one who blocked can)
    async unblockUser(blockId: number, userId: number): Promise<void> {
        const block = await this.friendshipRepository.findOne({
            where: {
                id: blockId,
                requester: { id: userId },
                status: FriendshipStatus.BLOCKED
            }
        });

        if (!block) {
            throw new NotFoundException('Block doesnt exist');
        }
        await this.friendshipRepository.delete(block.id);
    }
}
