import {
    Controller,
    Post,
    Delete,
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
import {ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiExcludeEndpoint, ApiBearerAuth} from '@nestjs/swagger';
import {plainToInstance} from "class-transformer";
import {validate} from "class-validator";
import {renderResetForm, renderResetResult} from "./reset-password.page";
import {LoginDto} from "./dto/login.dto";
import {UsersService} from "../users/users.service";
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import {JwtAuthGuard} from "./guards/jwt-auth.guard";
import {GoogleAuthGuard} from "./guards/google-auth.guard";
import {ResetPasswordDto} from "./dto/ResetPassword.dto";
import {ConfigService} from "@nestjs/config";
import {ThrottleAuth} from "./auth-throttle";
import {AllowUnverified} from "./decorators/allow-unverified.decorator";

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
    @AllowUnverified()
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

    // plafonnee comme les routes d'auth : chaque appel envoie un vrai mail
    @ApiOperation({ summary: 'Send a new verification email to the logged-in user' })
    @ApiBearerAuth()
    @ApiResponse({ status: 201, description: 'Verification email sent' })
    @ApiResponse({ status: 400, description: 'Email already verified' })
    @ApiResponse({ status: 503, description: 'Email could not be sent' })
    @ThrottleAuth()
    @AllowUnverified()
    @UseGuards(JwtAuthGuard)
    @Post('resend-verification')
    async resendVerification(@Req() req: any) {
        return await this.authService.resendVerification(req.user.id);
    }

    @ApiOperation({ summary: 'Redirect to Google OAuth (add ?link=<ticket> to link instead of log in)' })
    @ApiQuery({ name: 'link', required: false, description: 'Ticket from POST /auth/google/link-ticket' })
    @Get('google/web')
    @UseGuards(GoogleAuthGuard)
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
    @UseGuards(GoogleAuthGuard)
    async googleCallback(@Req() req: any, @Query('state') state: string, @Res() res: Response) {
        const appUrl = this.config.get<string>('OAUTH_APP_REDIRECT');

        // retour d'une liaison : pas de nouveau jwt, l'app est deja connectee
        if (state) {
            let fragment = 'linked=1';
            try {
                await this.authService.linkGoogle(state, req.user);
            } catch (e: any) {
                fragment = `linkError=${encodeURIComponent(e.message)}`;
            }
            return appUrl ? res.redirect(`${appUrl}#${fragment}`) : res.json({ result: fragment });
        }

        const { access_token } = await this.authService.handleGoogleUser(req.user);
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
        const identity = await this.authService.verifyGoogleToken(body.token);
        return await this.authService.handleGoogleUser(identity);
    }

    @ApiOperation({ summary: 'Get a one-time ticket to link a Google account (then open /auth/google/web?link=<ticket>)' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('google/link-ticket')
    async googleLinkTicket(@Req() req: any) {
        return await this.authService.createGoogleLinkTicket(req.user.id);
    }

    @ApiOperation({ summary: 'Unlink the Google account' })
    @ApiBearerAuth()
    @ApiResponse({ status: 400, description: 'Account has no password, unlinking would lock the user out' })
    @UseGuards(JwtAuthGuard)
    @Delete('google/link')
    async googleUnlink(@Req() req: any) {
        return await this.authService.unlinkGoogle(req.user.id);
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

    // cible du lien envoye par mail : le post json ci-dessus reste l'api,
    // cette page est la porte d'entree pour un humain
    @ApiOperation({ summary: 'Password reset page opened from the email link (HTML)' })
    @ApiQuery({ name: 'token', description: 'Password reset token', required: true })
    @ThrottleAuth()
    @Get('reset-password')
    async resetPasswordPage(@Query('token') token: string, @Res() res: Response) {
        const valid = await this.usersService.isPasswordResetTokenValid(token);
        res.status(valid ? 200 : 400).type('html').send(
            valid ? renderResetForm(token) : renderResetResult(false),
        );
    }

    // le formulaire arrive en urlencoded, pas en json : on valide a la main avec
    // le meme dto pour rendre les erreurs dans la page plutot qu'en json
    @ApiExcludeEndpoint()
    @ThrottleAuth()
    @Post('reset-password/form')
    async resetPasswordForm(@Body() body: Record<string, string>, @Res() res: Response) {
        const token = String(body?.token ?? '');
        const newPassword = String(body?.newPassword ?? '');

        const dto = plainToInstance(ResetPasswordDto, { token, newPassword });
        const errors = (await validate(dto)).flatMap((e) => Object.values(e.constraints ?? {}));
        if (newPassword !== String(body?.passwordConfirm ?? ''))
            errors.push('Les mots de passe ne correspondent pas.');
        if (errors.length)
            return res.status(400).type('html').send(renderResetForm(token, errors));

        const success = await this.usersService.verifyPasswordResetToken(token, newPassword);
        res.status(success ? 200 : 400).type('html').send(renderResetResult(success));
    }
}