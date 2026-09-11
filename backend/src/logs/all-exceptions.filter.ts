import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { LogChannel } from './log.entity';
import { LogsService } from './logs.service';
import { clientContextFromHeaders } from './client-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('HTTP');

    constructor(private readonly logs: LogsService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        // le filtre attrape aussi les gateways : ni request ni response a
        // manipuler la-bas, et LogsInterceptor a deja trace l'echec
        if (host.getType() !== 'http') {
            this.logger.warn(`✗ ${exception instanceof Error ? exception.message : 'unknown error'}`);
            return;
        }

        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const status = exception instanceof HttpException ? exception.getStatus() : 500;
        const res = exception instanceof HttpException ? exception.getResponse() : null;
        const message =
            res && typeof res === 'object' && 'message' in res
                ? (res as any).message
                : exception instanceof HttpException
                  ? exception.message
                  : 'Internal server error';

        this.logs.record({
            ...clientContextFromHeaders(request.headers),
            channel: LogChannel.HTTP,
            action: `${request.method} ${request.url}`,
            userId: request.user?.id ?? null,
            username: request.user?.username ?? null,
            statusCode: status,
            // l'instant d'entree vit dans LogsInterceptor, qui ne voit pas
            // passer les erreurs : la duree d'un echec n'est pas mesuree
            durationMs: 0,
            success: false,
            error: Array.isArray(message) ? message.join(' | ') : String(message),
            ip: request.ip ?? null,
        });

        response.status(status).json({
            statusCode: status,
            message,
        });
    }
}
