import {Controller, Get, Req, UseGuards} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {ApiOperation, ApiResponse} from "@nestjs/swagger";

@Controller('users')
export class UsersController {


    @ApiOperation({ summary: 'info about me' })
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Req() req: any) {

        return req.user;
        // ou
        return { message: 'ok' };
    }
}