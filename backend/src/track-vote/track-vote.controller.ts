import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventService } from './event.service';
import { TrackVoteService } from './track-vote.service';
import { TrackVoteGateway } from './track-vote.gateway';
import { AddTrackDto } from '../playlist-editor/dto/add-track.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { RetractVoteDto } from './dto/retract-vote.dto';
import { ImportPlaylistDto } from './dto/import-playlist.dto';

// rest sert au premier chargement et de repli si le socket ne passe pas, meme
// role que ListeningController
@ApiTags('track-vote')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('track-vote')
export class TrackVoteController {
    constructor(
        private events: EventService,
        private trackVote: TrackVoteService,
        private gateway: TrackVoteGateway,
    ) {}

    @ApiOperation({ summary: 'Get the current vote board for an event' })
    @ApiResponse({ status: 404, description: 'Event not found or private and not invited' })
    @Get('events/:id/board')
    async getBoard(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        await this.events.assertCanView(id, user.id);
        return this.trackVote.getBoard(id, user.id);
    }

    @ApiOperation({ summary: 'Suggest a track for this event' })
    @Post('events/:id/tracks')
    async suggestTrack(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddTrackDto,
    ) {
        await this.events.assertCanView(id, user.id);
        const track = await this.trackVote.suggestTrack(id, dto);
        await this.gateway.broadcastBoard(id);
        return track;
    }

    @ApiOperation({ summary: 'Import all tracks from one of my playlists into this event' })
    @ApiResponse({ status: 403, description: 'Not your playlist' })
    @Post('events/:id/import-playlist')
    async importPlaylist(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ImportPlaylistDto,
    ) {
        await this.events.assertCanView(id, user.id);
        const result = await this.trackVote.importPlaylist(id, user.id, dto.playlistId);
        await this.gateway.broadcastBoard(id);
        return result;
    }

    @ApiOperation({ summary: 'Vote for a track (a user may vote for several tracks, once each)' })
    @ApiResponse({ status: 400, description: 'Location required for a geo-restricted event' })
    @ApiResponse({ status: 403, description: 'Not allowed to vote (license/visibility)' })
    @Put('events/:id/vote')
    async castVote(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CastVoteDto,
    ) {
        const position = dto.latitude != null && dto.longitude != null
            ? { latitude: dto.latitude, longitude: dto.longitude }
            : undefined;
        await this.events.assertCanVote(id, user.id, position);
        await this.trackVote.castVote(id, user.id, dto.trackId);
        await this.gateway.broadcastBoard(id);
        return this.trackVote.getBoard(id, user.id);
    }

    @ApiOperation({ summary: 'Retract my vote for one track' })
    @Delete('events/:id/vote/:trackId')
    async retractVote(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('trackId', ParseIntPipe) trackId: number,
        @Query() query: RetractVoteDto,
    ) {
        const position = query.latitude != null && query.longitude != null
            ? { latitude: query.latitude, longitude: query.longitude }
            : undefined;
        await this.events.assertCanVote(id, user.id, position);
        await this.trackVote.retractVote(id, user.id, trackId);
        await this.gateway.broadcastBoard(id);
        return this.trackVote.getBoard(id, user.id);
    }
}
