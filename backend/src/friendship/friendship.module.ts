import { Module } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { FriendshipController } from './friendship.controller';
import {TypeOrmModule} from "@nestjs/typeorm";
import {Friendship} from "./friendship.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Friendship])],
  providers: [FriendshipService],
  controllers: [FriendshipController],
  exports: [FriendshipService],
})
export class FriendshipModule {}
