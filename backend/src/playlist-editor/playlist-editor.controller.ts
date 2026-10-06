import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlaylistEditorService } from './playlist-editor.service';
import { PlaylistEditorGateway } from './playlist-editor.gateway';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddTrackDto } from './dto/add-track.dto';
import { ReorderTracksDto } from './dto/reorder-tracks.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';

// rest sert au premier chargement et de repli si le socket ne passe pas, meme
// role que TrackVoteController. chaque mutation rediffuse a la room, sinon une
// edition faite en repli resterait invisible des clients en websocket
@ApiTags('playlist-editor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('playlist-editor')
export class PlaylistEditorController {
    constructor(
        private readonly service: PlaylistEditorService,
        private readonly gateway: PlaylistEditorGateway,
    ) {}

    // POST create a playlist
    @ApiOperation({ summary: 'Create a playlist' })
    @Post()
    create(@CurrentUser() user: { id: number }, @Body() dto: CreatePlaylistDto) {
        return this.service.create(user.id, dto);
    }

    @ApiOperation({ summary: 'List the playlists I own or co-edit, then the public playlists of other users' })
    @Get()
    findMine(@CurrentUser() user: { id: number }) {
        return this.service.findMine(user.id);
    }

    // GET one playlist
    @ApiOperation({ summary: 'Get a playlist with its tracks' })
    @ApiResponse({ status: 403, description: 'Playlist is private and you are neither owner nor editor' })
    @ApiResponse({ status: 404, description: 'Playlist not found' })
    @Get(':id')
    findOne(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.findOne(id, user.id);
    }

    // PATCH update the playlist then broadcast
    @ApiOperation({ summary: 'Rename or change visibility of a playlist' })
    @Patch(':id')
    async update(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdatePlaylistDto,
    ) {
        const playlist = await this.service.update(id, user.id, dto);
        await this.gateway.broadcastState(id);
        return playlist;
    }

    // DELETE the playlist
    @ApiOperation({ summary: 'Delete a playlist' })
    @Delete(':id')
    remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id, user.id);
    }

    // POST add a track then broadcast
    @ApiOperation({ summary: 'Add a Deezer track to a playlist' })
    @Post(':id/tracks')
    async addTrack(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddTrackDto,
    ) {
        const track = await this.service.addTrack(id, user.id, dto);
        await this.gateway.broadcastState(id);
        return track;
    }

    // DELETE a track then broadcast
    @ApiOperation({ summary: 'Remove a track from a playlist' })
    @Delete(':id/tracks/:trackId')
    async removeTrack(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('trackId', ParseIntPipe) trackId: number,
    ) {
        await this.service.removeTrack(id, trackId, user.id);
        await this.gateway.broadcastState(id);
    }

    // PATCH reorder then broadcast (409 if the version is old)
    @ApiOperation({ summary: 'Reorder the tracks of a playlist' })
    @ApiResponse({ status: 409, description: 'Playlist changed while you were reordering' })
    @Patch(':id/tracks/reorder')
    async reorder(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ReorderTracksDto,
    ) {
        const state = await this.service.reorder(id, user.id, dto.trackIds, dto.version);
        await this.gateway.broadcastState(id);
        return state;
    }

    // GET the editors
    @ApiOperation({ summary: 'List the editors of a playlist' })
    @Get(':id/collaborators')
    listCollaborators(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.service.listCollaborators(id, user.id);
    }

    // POST invite an editor
    @ApiOperation({ summary: 'Grant edit rights on a playlist to another user' })
    @ApiResponse({ status: 403, description: 'Only the owner can invite editors' })
    @Post(':id/collaborators')
    addCollaborator(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: AddCollaboratorDto,
    ) {
        return this.service.addCollaborator(id, user.id, dto.userId);
    }

    // DELETE remove an editor
    @ApiOperation({ summary: 'Revoke edit rights' })
    @Delete(':id/collaborators/:userId')
    removeCollaborator(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('userId', ParseIntPipe) userId: number,
    ) {
        return this.service.removeCollaborator(id, user.id, userId);
    }
}
