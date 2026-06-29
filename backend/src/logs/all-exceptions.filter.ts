import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private logger = new Logger('HTTP');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();
        const status =
            exception instanceof HttpException ? exception.getStatus() : 500;
        const res =
            exception instanceof HttpException ? exception.getResponse() : null;
        const message =
            res && typeof res === 'object' && 'message' in res
                ? (res as any).message
                : exception instanceof HttpException
                    ? exception.message
                    : 'Internal server error';

        this.logger.warn(`✗ ${request.method} ${request.url} - ${status} - ${message}`);

        response.status(status).json({
            statusCode: status,
            message,
        });
    }
}