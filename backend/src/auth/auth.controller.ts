import {Controller, Post, Body, Get, Query, BadRequestException} from '@nestjs/common';
import {RegisterDto} from "./dto/register.dto";
import {AuthService} from "./auth.service";
import {ApiTags, ApiOperation, ApiResponse, ApiQuery} from '@nestjs/swagger';
import {LoginDto} from "./dto/login.dto";
import {MailService} from "../mail/mail.service";
import {UsersService} from "../users/users.service";

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

    @ApiOperation({ summary: 'Verify email' })
    @ApiResponse({ status: 200, description: 'Email verified successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    @ApiQuery({ name: 'token', description: 'Email verification token', required: true })
    @Get('verify-email')
    async verifyMail(@Query('token') token: string) {
        const success = await this.usersService.verifyEmailToken(token);

        if (!success) {
            throw new BadRequestException('Invalid or expired token');
        }
        return true;
    }
}