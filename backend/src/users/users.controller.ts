import {Body, Controller, Get, NotFoundException, Patch, Req, UseGuards} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {ApiOperation, ApiResponse} from "@nestjs/swagger";
import {CurrentUser} from "../auth/decorators/current-user.decorator";
import { UsersService } from './users.service';
import {UpdateProfileDto} from "./dto/update-profile.dto";

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) {}


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
            visibilitySettings: fulluser.visibilitySettings,
            oAuthProvider: fulluser.oAuthProvider,
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
            musicpreferences: updatedUser.musicpreferences,
            visibilitySettings: updatedUser.visibilitySettings,
        };
    }
}