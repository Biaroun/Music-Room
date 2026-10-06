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
import {GoogleCodeDto, GoogleIdTokenDto} from "./dto/google.dto";
import {decodeFlowState, isAllowedAppRedirect} from "./google-flow";

// all the /auth routes
@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService,
                private usersService: UsersService,
                private config: ConfigService) {}

    // POST /auth/register create an account
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already exists' })
    @ThrottleAuth()
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return await this.authService.register(dto);
    }

    // POST /auth/login return a jwt
    @ApiOperation({ summary: 'Login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid email or password' })
    @ThrottleAuth()
    @Post('login')
    async login(@Body() dto: LoginDto){
        return await this.authService.login(dto);
    }

    // POST /auth/logout blacklist the current token
    @ApiOperation({ summary: 'Logout' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    @AllowUnverified()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@NestHeaders('authorization') auth: string) {
        // header is Bearer xxx so [1] = the token
        const token = auth.split(' ')[1];
        await this.authService.logout(token);
        return { message: 'Logged out successfully' };
    }

    // GET /auth/verify email link from the mail (return a small html page)
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

    // GET /auth/google/web empty on purpose (the guard redirect to google)
    @ApiOperation({ summary: 'Redirect to Google OAuth, then back to the app with #code=... (or #error=...)' })
    @ApiQuery({ name: 'redirect', required: true, description: 'App url to come back to, must be allowed by OAUTH_APP_REDIRECT' })
    @ApiQuery({ name: 'challenge', required: true, description: 'PKCE challenge: base64url sha256 of a verifier kept by the app' })
    @ApiResponse({ status: 400, description: 'redirect not allowed or challenge malformed' })
    @Get('google/web')
    @UseGuards(GoogleAuthGuard)
    async googleAuth() {}

    @ApiExcludeEndpoint()
    @Get('google/web/callback')
    @UseGuards(GoogleAuthGuard)
    async googleCallback(@Req() req: any, @Query('state') state: string, @Res() res: Response) {
        const flow = decodeFlowState(state);
        if (!flow || !isAllowedAppRedirect(flow.redirect, this.config.get<string>('OAUTH_APP_REDIRECT')))
            throw new BadRequestException('Invalid Google sign-in request, start again from the app');

        const fragment = req.user
            ? `code=${await this.authService.createGoogleCode(req.user, flow.challenge)}`
            : `error=${encodeURIComponent(req.googleError ?? 'Google sign-in failed')}`;
        return res.redirect(`${flow.redirect}#${fragment}`);
    }

    @ApiOperation({ summary: 'Log in with the code returned by the Google flow' })
    @ApiResponse({ status: 201, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Code unknown, expired, already used or wrong verifier' })
    @ApiResponse({ status: 409, description: 'An unverified account already uses this email' })
    @ThrottleAuth()
    @Post('google/exchange')
    async googleExchange(@Body() dto: GoogleCodeDto) {
        return await this.authService.exchangeGoogleCode(dto.code, dto.verifier);
    }

    // POST /auth/google/mobile login with a google id token from the app
    @ApiOperation({ summary: 'Log in with a Google id token (native Google sign-in)' })
    @ApiResponse({ status: 401, description: 'Invalid Google token' })
    @ThrottleAuth()
    @Post('google/mobile')
    async googleMobile(@Body() dto: GoogleIdTokenDto) {
        const identity = await this.authService.verifyGoogleToken(dto.token);
        return await this.authService.handleGoogleUser(identity);
    }

    @ApiOperation({ summary: 'Link the Google account from the Google flow code to the logged-in user' })
    @ApiBearerAuth()
    @ApiResponse({ status: 401, description: 'Code unknown, expired, already used or wrong verifier' })
    @ApiResponse({ status: 409, description: 'This Google account is already linked to another account' })
    @ThrottleAuth()
    @UseGuards(JwtAuthGuard)
    @Post('google/link')
    async googleLink(@Req() req: any, @Body() dto: GoogleCodeDto) {
        return await this.authService.linkGoogle(req.user.id, dto.code, dto.verifier);
    }

    // DELETE /auth/google/link remove the google link
    @ApiOperation({ summary: 'Unlink the Google account' })
    @ApiBearerAuth()
    @ApiResponse({ status: 400, description: 'Account has no password, unlinking would lock the user out' })
    @UseGuards(JwtAuthGuard)
    @Delete('google/link')
    async googleUnlink(@Req() req: any) {
        return await this.authService.unlinkGoogle(req.user.id);
    }

    // POST /auth/forgot password send the reset mail
    @ApiOperation({ summary: 'Request password reset email' })
    @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
    @ThrottleAuth()
    @Post('forgot-password')
    async forgot_password(@Body('email') email: string) {
        return await this.authService.forgot_password(email);
    }

    // POST /auth/reset password json version
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
        // String() so a missing field become an empty string (no crash)
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