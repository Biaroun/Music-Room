import {
    Controller,
    Post,
    Body,
    Get,
    Query,
    BadRequestException,
    UseGuards,
    Headers as NestHeaders,
    Req,
    Logger
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
import {ResetPasswordDto} from "./dto/ResetPassword.dto";
import {OAuthProvider} from "../users/user.entity";
import {ConfigService} from "@nestjs/config";
import {ThrottleAuth} from "./auth-throttle";

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(private authService: AuthService,
                private usersService: UsersService,
                private config: ConfigService) {}

    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already exists' })
    @ThrottleAuth()
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return await this.authService.register(dto);
    }

    @ApiOperation({ summary: 'Login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid email or password' })
    @ThrottleAuth()
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
    @ThrottleAuth()
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

    /**
     * google renvoie ici, sur la seule uri enregistree dans la console cloud.
     * on echange, on cree notre jwt, puis on redirige vers l'app avec le token
     * dans le fragment : un fragment n'est jamais envoye au serveur, donc il ne
     * finit ni dans les logs d'acces ni dans un en-tete Referer.
     *
     * la cible de redirection vient de la configuration, jamais d'un parametre
     * de la requete : sinon n'importe qui pourrait se faire renvoyer le jwt
     * d'un utilisateur sur son propre site (open redirect).
     */
    @Get('google/web/callback')
    @UseGuards(AuthGuard('google'))
    async googleCallback(@Req() req: any, @Res() res: Response) {
        const { access_token } = await this.authService.handleOAuthUser(
            req.user.email,
            req.user.username,
            req.user.provider,
        );

        const appUrl = this.config.get<string>('OAUTH_APP_REDIRECT');
        if (!appUrl) {
            // pas d'app configuree : on rend le token tel quel, utile pour
            // tester la route au navigateur. on previent, sinon l'utilisateur
            // voit un json et croit a un bug de l'app
            this.logger.warn(
                'OAUTH_APP_REDIRECT absent : le token est renvoye en json au lieu de repartir vers l\'app',
            );
            return res.json({ access_token });
        }
        return res.redirect(`${appUrl}#token=${encodeURIComponent(access_token)}`);
    }

    @Post('google/mobile')
    async googleMobile(@Body() body: { token: string }) {
        const { email, username } = await this.authService.verifyGoogleToken(body.token);
        return await this.authService.handleOAuthUser(email, username, OAuthProvider.GOOGLE);
    }

    @ApiOperation({ summary: 'Request password reset email' })
    @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
    @ThrottleAuth()
    @Post('forgot-password')
    async forgot_password(@Body('email') email: string) {
        return await this.authService.forgot_password(email);
    }

    @ApiOperation({ summary: 'Reset password with token' })
    @ApiResponse({ status: 200, description: 'Password reset successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    @ThrottleAuth()
    @Post('reset-password')
    async reset_password(@Body() dto: ResetPasswordDto) {
        return await this.authService.resetPassword(dto.token, dto.newPassword);
    }
}