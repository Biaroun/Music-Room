import {Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {ApiOperation, ApiResponse, ApiParam} from "@nestjs/swagger";
import {CurrentUser} from "../auth/decorators/current-user.decorator";
import { UsersService } from './users.service';
import {UpdateProfileDto} from "./dto/update-profile.dto";
import {UpdateEmailDto} from "./dto/update-email.dto";
import {UpdatePasswordDto} from "./dto/update-password.dto";
import {FriendshipService} from "../friendship/friendship.service";
import {Visibility} from "./user.entity";

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService,
                private friendshipService: FriendshipService) {}


    // a garder declaree avant @Get(':id'), sinon /users/search tombe dans :id
    @ApiOperation({ summary: 'Search or list users by username' })
    @ApiResponse({ status: 200, description: 'Users matching the query (all users if q is empty)' })
    @UseGuards(JwtAuthGuard)
    @Get('search')
    async searchUsers(@CurrentUser() user: { id: number }, @Query('q') query?: string) {
        const users = await this.usersService.searchByUsername(query ?? '', user.id);
        return users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar }));
    }

    @ApiOperation({ summary: 'info about me' })
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@CurrentUser() user: { id: number; username: string}) {
        const fulluser = await this.usersService.findById(user.id);

        if (!fulluser) {
            throw new NotFoundException('User not found');
        }

        return {
            id: fulluser.id,
            username: fulluser.username,
            email: fulluser.email,
            emailisVerified: fulluser.emailisVerified,
            musicpreferences: fulluser.musicpreferences,
            bio: fulluser.bio,
            avatar: fulluser.avatar,
            visibilitySettings: fulluser.visibilitySettings,
            oAuthProvider: fulluser.oAuthProvider,
            // null si aucun compte google n'est lie
            googleEmail: fulluser.googleEmail ?? null,
            // un compte google sans mot de passe ne peut pas delier google
            hasPassword: !!fulluser.password,
            createdAt: fulluser.createdAt,
            updatedAt: fulluser.updatedAt,
        };
    }

    @ApiOperation({ summary: 'update my profile' })
    @UseGuards(JwtAuthGuard)
    @Patch('me')
    async updateMe(@CurrentUser() user: { id: number }, @Body() dto: UpdateProfileDto) {
        const updatedUser = await this.usersService.updateProfile(user.id, dto);

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        return {
            id: updatedUser.id,
            username: updatedUser.username,
            bio: updatedUser.bio,
            avatar: updatedUser.avatar,
            musicpreferences: updatedUser.musicpreferences,
            visibilitySettings: updatedUser.visibilitySettings,
        };
    }

    @ApiOperation({ summary: 'update my email' })
    @UseGuards(JwtAuthGuard)
    @Patch('me/email')
    async updateEmail(@CurrentUser() user: { id: number }, @Body() dto: UpdateEmailDto) {
        const updatedUser = await this.usersService.updateEmail(user.id, dto);

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        return {
            newmail: updatedUser.email,
        };
    }

    @ApiOperation({ summary: 'update my password' })
    @UseGuards(JwtAuthGuard)
    @Patch('me/password')
    async updatePassword(@CurrentUser() user: { id: number }, @Body() dto: UpdatePasswordDto) {
        const updatedUser = await this.usersService.updatePassword(user.id, dto);

        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }

        return { message: 'Password updated successfully' };
    }

    @ApiOperation({ summary: 'Get user profile by id' })
    @ApiParam({ name: 'id', description: 'Id of the user to get' })
    @ApiResponse({ status: 200, description: 'User profile' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @UseGuards(JwtAuthGuard)
    @Get(':id')
    async getUserProfile(@CurrentUser() user: { id: number }, @Param('id') id: string) {
        const targetUser = await this.usersService.findById(parseInt(id));

        if (!targetUser) {
            throw new NotFoundException('User not found');
        }
        const friends = await this.friendshipService.areFriends(user.id, parseInt(id));

        const visibility = targetUser.visibilitySettings;
        const defaultVis = Visibility.PUBLIC; // si null

        const isFieldVisible = (fieldVisibility: Visibility | undefined) => {
            const vis = fieldVisibility ?? defaultVis;
            if (vis === Visibility.PUBLIC) return true;
            if (vis === Visibility.FRIENDS_ONLY) return friends;
            return false; // PRIVATE
        };

        return {
            id: targetUser.id,
            username: targetUser.username,
            avatar: targetUser.avatar,
            bio: isFieldVisible(visibility?.bio) ? targetUser.bio : null,
            musicpreferences: isFieldVisible(visibility?.musicPreferences) ? targetUser.musicpreferences : null,
        };
    }
}