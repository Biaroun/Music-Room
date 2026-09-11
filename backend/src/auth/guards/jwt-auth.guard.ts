import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        @InjectRepository(User) private users: Repository<User>,
    ) {
        super();
    }

    // sujet v.1 : un jwt valide ne suffit plus, le compte doit avoir verifie
    // son mail (sauf sur les routes marquees @AllowUnverified)
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const authenticated = (await super.canActivate(context)) as boolean;
        if (!authenticated)
            return false;

        const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (allowUnverified)
            return true;

        const req = context.switchToHttp().getRequest();
        const user = await this.users.findOneBy({ id: req.user.id });
        if (!user?.emailisVerified)
            throw new ForbiddenException('Email not verified');
        return true;
    }
}