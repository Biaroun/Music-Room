import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ip exemptees de tout plafond, lues dans THROTTLE_ALLOWLIST (vide par defaut).
 * sert au test de charge v.7 : sans elle la campagne mesure le limiteur et pas
 * l'application. a ne remplir que le temps de la campagne.
 */
export function throttleAllowlist(raw: string | undefined): string[] {
    return (raw ?? '')
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);
}

// true if the client ip is in the allowlist (http only)
export function isAllowlisted(context: ExecutionContext, allowlist: string[]): boolean {
    if (!allowlist.length || context.getType() !== 'http') return false;
    const request = context.switchToHttp().getRequest();
    const forwarded = request?.headers?.['x-forwarded-for'];
    const ip =
        typeof forwarded === 'string' && forwarded
            // the first ip of x forwarded for = the real client
            ? forwarded.split(',')[0].trim()
            : (request?.ip ?? request?.socket?.remoteAddress);
    // express rend les ipv4 en ::ffff:127.0.0.1 en dual-stack
    return typeof ip === 'string' && allowlist.includes(ip.replace(/^::ffff:/, ''));
}

/**
 * ThrottlerGuard lit switchToHttp(), vide hors http. en pratique
 * @nestjs/websockets ne transmet pas l'ApplicationConfig a son
 * GuardsContextCreator, donc un APP_GUARD n'atteint deja pas les
 * @SubscribeMessage : ce court-circuit est un filet si on pose un jour le guard
 * a la main sur un gateway.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
    // on skip everything that is not http (websockets)
    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') return true;
        return super.canActivate(context);
    }

    /**
     * derriere un reverse proxy toutes les requetes portent l'ip du proxy :
     * sans ca un seul attaquant consomme le quota de tout le monde.
     */
    protected getTracker(req: Record<string, any>): Promise<string> {
        const forwarded = req.headers?.['x-forwarded-for'];
        // first ip of the list = the client (the rest are proxies)
        if (typeof forwarded === 'string' && forwarded) return Promise.resolve(forwarded.split(',')[0].trim());
        return Promise.resolve(req.ip ?? req.socket?.remoteAddress ?? 'unknown');
    }
}
