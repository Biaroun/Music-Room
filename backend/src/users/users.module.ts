import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import {MailModule} from "../mail/mail.module";
import {FriendshipModule} from "../friendship/friendship.module";

// users module (service exported for auth)
@Module({
  imports: [TypeOrmModule.forFeature([User]), MailModule,FriendshipModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
