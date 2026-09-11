import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Socket } from 'socket.io';
import { LogChannel } from './log.entity';
import { LogsService } from './logs.service';
import { clientContextFromHeaders, clientContextFromSocket } from './client-context';

// nom de l'evenement pose par @SubscribeMessage
const WS_MESSAGE_METADATA = 'message';

/**
 * un seul interceptor pour http et websocket : depuis le passage du
 * playlist-editor en temps reel, une partie des actions ne passe plus par http.
 * context.getType() suffit a les distinguer.
 */
@Injectable()
export class LogsInterceptor implements NestInterceptor {
    constructor(private readonly logs: LogsService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const type = context.getType<'http' | 'ws' | 'rpc'>();
        if (type === 'http') return this.interceptHttp(context, next);
        if (type === 'ws') return this.interceptWs(context, next);
        return next.handle();
    }

    private interceptHttp(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const action = `${request.method} ${request.url}`;
        const client = clientContextFromHeaders(request.headers);
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    this.logs.record({
                        ...client,
                        channel: LogChannel.HTTP,
                        action,
                        // request.user n'est pose qu'apres le guard, donc lu
                        // ici et pas a l'entree de l'interceptor
                        userId: request.user?.id ?? null,
                        username: request.user?.username ?? null,
                        statusCode: response.statusCode ?? 200,
                        durationMs: Date.now() - start,
                        success: true,
                        ip: this.ipOf(request),
                    });
                },
                // les erreurs passent par AllExceptionsFilter, qui connait le
                // statut renvoye : les tracer ici ferait deux lignes
            }),
        );
    }

    private interceptWs(context: ExecutionContext, next: CallHandler): Observable<any> {
        const client = context.switchToWs().getClient<Socket>();
        const event =
            Reflect.getMetadata(WS_MESSAGE_METADATA, context.getHandler()) ??
            `${context.getClass().name}.${context.getHandler().name}`;
        const device = clientContextFromSocket(client);
        const start = Date.now();

        // client.data.userId est pose par l'auth du gateway, qui tourne dans le
        // handler : lu apres coup, sinon le premier message serait anonyme.
        //
        // limite connue : success veut dire "le handler n'a pas leve". les
        // gateways rattrapent leurs erreurs pour emettre <feature>:error, donc
        // une edition refusee apparait ici en succes.
        const finish = (success: boolean, error?: unknown) =>
            this.logs.record({
                ...device,
                channel: LogChannel.REALTIME,
                action: String(event),
                userId: client?.data?.userId ?? null,
                username: client?.data?.username ?? null,
                statusCode: null,
                durationMs: Date.now() - start,
                success,
                error: error instanceof Error ? error.message : error != null ? String(error) : null,
                ip: client?.handshake?.address ?? null,
            });

        return next.handle().pipe(
            tap({
                next: () => finish(true),
                error: (err) => finish(false, err),
            }),
        );
    }

    /** derriere un reverse proxy, l'ip reelle est dans x-forwarded-for */
    private ipOf(request: any): string | null {
        const forwarded = request.headers?.['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
        return request.ip ?? request.socket?.remoteAddress ?? null;
    }
}

