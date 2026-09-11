import { Module } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { FriendshipController } from './friendship.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Friendship} from "./friendship.entity";
import {User} from "../users/user.entity";

@Module({
  // User : JwtAuthGuard en a besoin pour le controle emailisVerified
  imports: [TypeOrmModule.forFeature([Friendship, User])],
  providers: [FriendshipService],
  controllers: [FriendshipController],
  exports: [FriendshipService],
})
export class FriendshipModule {}
