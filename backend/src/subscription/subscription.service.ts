import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, SubscriptionPlan } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SubscriptionService {
    constructor(
        @InjectRepository(User) private users: Repository<User>,
        private mail: MailService,
    ) {}

    async subscribe(userId: number): Promise<User> {
        const user = await this.findUser(userId);
        if (user.plan === SubscriptionPlan.PREMIUM) {
            throw new ConflictException('You already have an active subscription');
        }

        user.plan = SubscriptionPlan.PREMIUM;
        user.subscribedAt = new Date();
        const saved = await this.users.save(user);

        await this.mail.sendSubscriptionConfirmedEmail(saved.email);
        return saved;
    }

    async cancel(userId: number): Promise<User> {
        const user = await this.findUser(userId);
        if (user.plan === SubscriptionPlan.FREE) {
            throw new ConflictException('You have no active subscription');
        }

        user.plan = SubscriptionPlan.FREE;
        user.subscribedAt = null;
        const saved = await this.users.save(user);

        await this.mail.sendSubscriptionCancelledEmail(saved.email);
        return saved;
    }

    /** utilise par track-vote pour gater la creation/gestion des events */
    async isPremium(userId: number): Promise<boolean> {
        const user = await this.users.findOne({ where: { id: userId } });
        return user?.plan === SubscriptionPlan.PREMIUM;
    }

    private async findUser(userId: number): Promise<User> {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }
}
