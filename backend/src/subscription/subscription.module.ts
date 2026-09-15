import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

// subscription module (service exported for track vote)
@Module({
  imports: [TypeOrmModule.forFeature([User]), MailModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
