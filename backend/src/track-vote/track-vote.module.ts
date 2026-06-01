import { Module } from '@nestjs/common';
import { TrackVoteController } from './track-vote.controller';
import { TrackVoteService } from './track-vote.service';

@Module({
  controllers: [TrackVoteController],
  providers: [TrackVoteService]
})
export class TrackVoteModule {}
