import { Controller, Post, Body } from '@nestjs/common';
import {RegisterDto} from "./dto/register.dto";
import {AuthService} from "./auth.service";
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already exists' })
    @Post('register')
    async create(@Body() dto: RegisterDto) {
        return await this.authService.register(dto);
    }

}