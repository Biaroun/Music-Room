import {ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Friendship, FriendshipStatus} from "./friendship.entity";
import {User} from "../users/user.entity";

@Injectable()
export class FriendshipService {

    constructor(
        @InjectRepository(Friendship)
        private friendshipRepository: Repository<Friendship>
    ) {}

    async isFriendshipExist(userAId: number, userBId: number): Promise<Friendship | null> {
        return await this.friendshipRepository.findOne({
            where: [
                { requester: { id: userAId }, receiver: { id: userBId } },
                { requester: { id: userBId }, receiver: { id: userAId } },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    async sendRequest(requesterId: number, receiverId: number): Promise<Friendship> {
        let relation = await this.isFriendshipExist(requesterId, receiverId);

        if (relation && requesterId !== relation.receiver.id) {
            throw new ConflictException('Friend request already sent');
        }

        if (relation) {
            relation.status = FriendshipStatus.ACCEPTED;
        } else {
            relation = this.friendshipRepository.create({
                requester: { id: requesterId } as User,
                receiver: { id: receiverId } as User,
            });
        }

        await this.friendshipRepository.save(relation);

        const saved = await this.friendshipRepository.findOne({
            where: { id: relation.id },
            relations: ['requester', 'receiver'],
        });

        if (!saved) {
            throw new NotFoundException('Friendship not found after save');
        }

        return saved;
    }

    async acceptRequest(requestId: number, receiverId: number): Promise<Friendship> {
        const relation = await this.friendshipRepository.findOne({
            where: { id: requestId, receiver: { id: receiverId } },
            relations: ['requester', 'receiver'],
        });

        if (!relation) {
            throw new NotFoundException('Request didnt exist');
        }

        relation.status = FriendshipStatus.ACCEPTED;
        return await this.friendshipRepository.save(relation);
    }

    async rejectRequest(requestId: number, receiverId: number): Promise<void> {
        const relation = await this.friendshipRepository.findOne({
            where: { id: requestId, receiver: { id: receiverId } }
        });

        if (!relation) {
            throw new NotFoundException('Request didnt exist');
        }

        await this.friendshipRepository.delete(relation.id);
    }

    async getPendingRequests(receiverId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: { receiver: { id: receiverId }, status: FriendshipStatus.PENDING },
            relations: ['requester', 'receiver'],
        });
    }

    async getFriends(userId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: [
                { requester: { id: userId }, status: FriendshipStatus.ACCEPTED },
                { receiver: { id: userId }, status: FriendshipStatus.ACCEPTED },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    async getBlocks(userId: number): Promise<Friendship[]> {
        return await this.friendshipRepository.find({
            where: [
                { requester: { id: userId }, status: FriendshipStatus.BLOCKED },
                { receiver: { id: userId }, status: FriendshipStatus.BLOCKED },
            ],
            relations: ['requester', 'receiver'],
        });
    }

    async blockUser(blockerId: number, targetId: number): Promise<Friendship> {
        const isblocked = await this.friendshipRepository.findOne({
            where: {
                requester: { id: targetId },
                receiver: { id: blockerId },
                status: FriendshipStatus.BLOCKED
            }
        });

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
