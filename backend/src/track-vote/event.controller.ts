import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@ApiTags('track-vote-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('track-vote/events')
export class EventController {
    constructor(private readonly events: EventService) {}

    @ApiOperation({ summary: 'Create an event around a playlist' })
    @Post()
    create(@CurrentUser() user: { id: number }, @Body() dto: CreateEventDto) {
        return this.events.create(user.id, dto);
    }

    @ApiOperation({ summary: 'List events I can see (public + mine + invited-to-private)' })
    @Get()
    findVisible(@CurrentUser() user: { id: number }) {
        return this.events.findVisible(user.id);
    }

    @ApiOperation({ summary: 'Get one event' })
    @ApiResponse({ status: 404, description: 'Event not found or private and not invited' })
    @Get(':id')
    findOne(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.events.findOneForUser(id, user.id);
    }

    @ApiOperation({ summary: 'Update an event (owner only)' })
    @Patch(':id')
    update(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEventDto) {
        return this.events.update(id, user.id, dto);
    }

    @ApiOperation({ summary: 'Delete an event (owner only)' })
    @Delete(':id')
    remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.events.remove(id, user.id);
    }

    @ApiOperation({ summary: 'Invite a user to a private/invite-only event (owner only)' })
    @Post(':id/invites/:userId')
    invite(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('userId', ParseIntPipe) userId: number,
    ) {
        return this.events.invite(id, user.id, userId);
    }

    @ApiOperation({ summary: 'Revoke an invite (owner only)' })
    @Delete(':id/invites/:userId')
    uninvite(
        @CurrentUser() user: { id: number },
        @Param('id', ParseIntPipe) id: number,
        @Param('userId', ParseIntPipe) userId: number,
    ) {
        return this.events.uninvite(id, user.id, userId);
    }

    @ApiOperation({ summary: 'List invited users (owner only)' })
    @Get(':id/invites')
    listInvited(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.events.listInvited(id, user.id);
    }
}
