import {
    Controller,
    Post,
    Body,
    Get,
    Query,
    BadRequestException,
    UseGuards,
    Headers as NestHeaders,
    Req
} from '@nestjs/common';
import {RegisterDto} from "./dto/register.dto";
import {AuthService} from "./auth.service";
import {ApiTags, ApiOperation, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {LoginDto} from "./dto/login.dto";
import {UsersService} from "../users/users.service";
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import {JwtAuthGuard} from "./guards/jwt-auth.guard";
import {AuthGuard} from "@nestjs/passport";

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService,
                private usersService: UsersService) {}

    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already exists' })
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return await this.authService.register(dto);
    }

    @ApiOperation({ summary: 'Login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid email or password' })
    @Post('login')
    async login(@Body() dto: LoginDto){
        return await this.authService.login(dto);
    }

    @ApiOperation({ summary: 'Logout' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@NestHeaders('authorization') auth: string) {
        const token = auth.split(' ')[1];
        await this.authService.logout(token);
        return { message: 'Logged out successfully' };
    }

    @ApiOperation({ summary: 'Verify email' })
    @ApiResponse({ status: 200, description: 'Email verified successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    @ApiQuery({ name: 'token', description: 'Email verification token', required: true })
    @Get('verify-email')
    async verifyMail(@Query('token') token: string, @Res() res: Response) {
        const success = await this.usersService.verifyEmailToken(token);

        const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Music Room - Email Verification</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: white; }
          h1 { color: ${success ? '#4ade80' : '#f87171'}; }
        </style>
      </head>
      <body>
        <h1>${success ? '✅ Email verified!' : '❌ Invalid or expired token'}</h1>
        <p>${success ? 'You can now close this page and return to the app.' : 'Please request a new verification email.'}</p>
      </body>
    </html>
  `;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }

    @ApiOperation({ summary: 'Redirect to Google OAuth' })
    @Get('google/web')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {}

    @Get('google/web/callback')
    @UseGuards(AuthGuard('google'))
    async googleCallback(@Req() req: any) {
        return await this.authService.handleOAuthUser(req.user.email, req.user.username, req.user.provider);
    }
}