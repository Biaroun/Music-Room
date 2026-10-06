import { BadRequestException, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { encodeFlowState, isAllowedAppRedirect, PKCE_CHALLENGE } from '../google-flow';

const isCallback = (req: any) => !!(req.query?.code || req.query?.error);

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    constructor(private config: ConfigService) {
        super();
    }

    getAuthenticateOptions(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest();
        if (isCallback(req))
            return {};

        const { redirect, challenge } = req.query ?? {};
        if (!isAllowedAppRedirect(redirect, this.config.get<string>('OAUTH_APP_REDIRECT')))
            throw new BadRequestException('redirect is not an allowed app url');
        if (typeof challenge !== 'string' || !PKCE_CHALLENGE.test(challenge))
            throw new BadRequestException('challenge must be a base64url sha256');

        return {
            state: encodeFlowState({ redirect, challenge }),
            prompt: 'select_account',
        };
    }

    handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
        const req = context.switchToHttp().getRequest();
        if (user || !isCallback(req))
            return super.handleRequest(err, user, info, context, status);

        if (err instanceof HttpException)
            req.googleError = err.message;
        else
            req.googleError = err ? 'Google sign-in failed' : 'Google sign-in was cancelled';
        return null;
    }
}
