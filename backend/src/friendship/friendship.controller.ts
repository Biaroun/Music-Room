import { Controller, Param, Post, Patch, Get, Delete, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FriendshipService } from './friendship.service';

@ApiTags('friendship')
@Controller('friendship')
export class FriendshipController {
    constructor(private friendshipService: FriendshipService) {}

    @ApiOperation({ summary: 'Send a friend request' })
    @ApiParam({ name: 'targetId', description: 'Id of the user to send a friend request to' })
    @ApiResponse({ status: 201, description: 'Friend request sent or automatically accepted' })
    @ApiResponse({ status: 409, description: 'Friend request already sent' })
    @UseGuards(JwtAuthGuard)
    @Post('request/:targetId')
    async sendRequest(@CurrentUser() user: { id: number }, @Param('targetId') targetId: string) {
        const relation = await this.friendshipService.sendRequest(user.id, parseInt(targetId));
        return {
            id: relation.id,
            status: relation.status,
            requester: relation.requester.username,
            receiver: relation.receiver.username,
        };
    }

    @ApiOperation({ summary: 'Cancel a pending friend request I sent' })
    @ApiParam({ name: 'requestId', description: 'Id of the friend request to cancel' })
    @ApiResponse({ status: 200, description: 'Friend request cancelled' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    @UseGuards(JwtAuthGuard)
    @Delete('request/:requestId')
    async cancelSentRequest(@CurrentUser() user: { id: number }, @Param('requestId') requestId: string) {
        await this.friendshipService.cancelSentRequest(parseInt(requestId), user.id);
        return { message: 'Friend request cancelled' };
    }

    @ApiOperation({ summary: 'Accept a pending friend request' })
    @ApiParam({ name: 'requestId', description: 'Id of the friend request to accept' })
    @ApiResponse({ status: 200, description: 'Friend request accepted' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    @UseGuards(JwtAuthGuard)
    @Patch(':requestId/accept')
    async acceptRequest(@CurrentUser() user: { id: number }, @Param('requestId') requestId: string) {
        const relation = await this.friendshipService.acceptRequest(parseInt(requestId), user.id);
        return {
            id: relation.id,
            status: relation.status,
            requester: relation.requester.username,
            receiver: relation.receiver.username,
        };
    }

    @ApiOperation({ summary: 'Reject a pending friend request' })
    @ApiParam({ name: 'requestId', description: 'Id of the friend request to reject' })
    @ApiResponse({ status: 200, description: 'Friend request rejected' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    @UseGuards(JwtAuthGuard)
    @Patch(':requestId/reject')
    async rejectRequest(@CurrentUser() user: { id: number }, @Param('requestId') requestId: string) {
        await this.friendshipService.rejectRequest(parseInt(requestId), user.id);
        return { message: 'Friend request rejected' };
    }

    @ApiOperation({ summary: 'Block a user' })
    @ApiParam({ name: 'targetId', description: 'Id of the user to block' })
    @ApiResponse({ status: 201, description: 'User blocked' })
    @UseGuards(JwtAuthGuard)
    @Post('block/:targetId')
    async blockUser(@CurrentUser() user: { id: number }, @Param('targetId') targetId: string) {
        const block = await this.friendshipService.blockUser(user.id, parseInt(targetId));
        return {
            id: block.id,
            blockedBy: block.requester.username,
            blockedUser: block.receiver.username,
        };
    }

    @ApiOperation({ summary: 'Unblock a user' })
    @ApiParam({ name: 'blockId', description: 'Id of the block relationship to remove' })
    @ApiResponse({ status: 200, description: 'User unblocked' })
    @ApiResponse({ status: 404, description: 'Block not found' })
    @UseGuards(JwtAuthGuard)
    @Delete('block/:blockId')
    async unblockUser(@CurrentUser() user: { id: number }, @Param('blockId') blockId: string) {
        await this.friendshipService.unblockUser(parseInt(blockId), user.id);
        return { message: 'User unblocked successfully' };
    }

    @ApiOperation({ summary: 'List my pending friend requests (received)' })
    @ApiResponse({ status: 200, description: 'List of pending friend requests' })
    @UseGuards(JwtAuthGuard)
    @Get('pending')
    async getPendingRequests(@CurrentUser() user: { id: number }) {
        const requests = await this.friendshipService.getPendingRequests(user.id);
        return requests.map(request => ({
            id: request.id,
            from: request.requester.username,
            fromId: request.requester.id,
            createdAt: request.createdAt,
        }));
    }

    @ApiOperation({ summary: 'List my pending friend requests (sent)' })
    @ApiResponse({ status: 200, description: 'List of pending friend requests I sent' })
    @UseGuards(JwtAuthGuard)
    @Get('pending/sent')
    async getSentPendingRequests(@CurrentUser() user: { id: number }) {
        const requests = await this.friendshipService.getSentPendingRequests(user.id);
        return requests.map(request => ({
            id: request.id,
            to: request.receiver.username,
            toId: request.receiver.id,
            createdAt: request.createdAt,
        }));
    }

    @ApiOperation({ summary: 'List my friends (accepted requests)' })
    @ApiResponse({ status: 200, description: 'List of friends' })
    @UseGuards(JwtAuthGuard)
    @Get('friends')
    async getFriends(@CurrentUser() user: { id: number }) {
        const relations = await this.friendshipService.getFriends(user.id);
        return relations.map(relation => {
            const friend = relation.requester.id === user.id ? relation.receiver : relation.requester;
            return {
                id: relation.id,
                friendId: friend.id,
                username: friend.username,
                avatar: friend.avatar,
            };
        });
    }

    @ApiOperation({ summary: 'List users I blocked or who blocked me' })
    @ApiResponse({ status: 200, description: 'List of blocked relationships' })
    @UseGuards(JwtAuthGuard)
    @Get('blocked')
    async getBlocks(@CurrentUser() user: { id: number }) {
        const blocks = await this.friendshipService.getBlocks(user.id);
        return blocks.map(block => ({
            id: block.id,
            blockedBy: block.requester.username,
            blockedById: block.requester.id,
            blockedUser: block.receiver.username,
            blockedUserId: block.receiver.id,
            isBlockedByMe: block.requester.id === user.id,
        }));
    }
}
    