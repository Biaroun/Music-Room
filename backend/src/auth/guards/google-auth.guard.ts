import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// /auth/google/web?link=<ticket> : le ticket part chez google dans le parametre
// state et revient tel quel au callback, c'est ce qui distingue une liaison
// d'une connexion
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    // pass the link ticket as state if there is one
    getAuthenticateOptions(context: ExecutionContext) {
        const link = context.switchToHttp().getRequest().query?.link;
        return typeof link === 'string' && link ? { state: link } : {};
    }
}
