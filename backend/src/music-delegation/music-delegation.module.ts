import { Module } from '@nestjs/common';
import { MusicDelegationController } from './music-delegation.controller';
import { MusicDelegationService } from './music-delegation.service';

@Module({
  controllers: [MusicDelegationController],
  providers: [MusicDelegationService]
})
export class MusicDelegationModule {}
