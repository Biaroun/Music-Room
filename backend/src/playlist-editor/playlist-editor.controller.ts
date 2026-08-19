import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlaylistEditorService } from './playlist-editor.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackDto } from './dto/add-track.dto';
import { ReorderTracksDto } from './dto/reorder-tracks.dto';

@ApiTags('playlist-editor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('playlist-editor')
export class PlaylistEditorController {
    constructor(private readonly service: PlaylistEditorService) {}

    @ApiOperation({ summary: 'Create a playlist' })
    @Post()
    create(@CurrentUser() user: { id: number }, @Body() dto: CreatePlaylistDto) {
        return this.service.create(user.id, dto);
    }

    @ApiOperation({ summary: 'List my playlists' })
    @Get()
    findMine(@CurrentUser() user: { id: number }) {
        return this.service.findMine(user.id);
    }

    @ApiOperation({ summary: 'Get a playlist with its tracks' })
    @ApiResponse({ status: 403, description: 'Playlist is private and you are not the owner' })
    @ApiResponse({ status: 404, description: 'Playlist not found' })
    @Get(':id')
    findOne(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id, user.id);
    }

    @ApiOperation({ summary: 'Rename or change visibility of a playlist' })
    @Patch(':id')
    update(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlaylistDto) {
        return this.service.update(id, user.id, dto);
    }

    @ApiOperation({ summary: 'Delete a playlist' })
    @Delete(':id')
    remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id, user.id);
    }

    @ApiOperation({ summary: 'Add a Deezer track to a playlist' })
    @Post(':id/tracks')
    addTrack(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: AddTrackDto) {
        return this.service.addTrack(id, user.id, dto);
    }

    @ApiOperation({ summary: 'Remove a track from a playlist' })
    @Delete(':id/tracks/:trackId')
    removeTrack(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('trackId', ParseIntPipe) trackId: number,
    ) {
        return this.service.removeTrack(id, trackId, user.id);
    }

    @ApiOperation({ summary: 'Reorder the tracks of a playlist' })
    @Patch(':id/tracks/reorder')
    reorder(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: ReorderTracksDto) {
        return this.service.reorder(id, user.id, dto.trackIds);
    }
}
