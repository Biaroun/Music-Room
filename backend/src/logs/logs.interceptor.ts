import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LogsInterceptor implements NestInterceptor {
    private logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url } = request;
        const start = Date.now();

        this.logger.log(`→ ${method} ${url}`);

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = Date.now() - start;
                    this.logger.log(`← ${method} ${url} - ${duration}ms`);
                },
                error: (error) => {
                    const duration = Date.now() - start;
                    this.logger.error(`← ${method} ${url} - ${duration}ms - ${error.status} ${error.message}`);
                },
            })
        );
    }
}