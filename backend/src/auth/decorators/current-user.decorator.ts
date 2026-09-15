import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// param decorator that give req user (set by the jwt strategy)
export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);