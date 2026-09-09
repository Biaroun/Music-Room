import { Body, Controller, Delete, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListeningService, HEARTBEAT_INTERVAL_MS, NOW_PLAYING_TTL_MS } from './listening.service';
import { UpdateListeningDto } from './dto/update-listening.dto';

// pendant rest du gateway : premier chargement et repli quand le socket ne
// passe pas. le sujet demande une api rest documentee, la fonctionnalite doit
// rester utilisable sans temps reel
@ApiTags('listening')
@ApiBearerAuth()
@Controller('listening')
export class ListeningController {
    constructor(private listening: ListeningService) {}

    @ApiOperation({
        summary: 'Déclarer le morceau que j\'écoute (sert aussi de heartbeat)',
        description: `À rappeler toutes les ${HEARTBEAT_INTERVAL_MS / 1000}s. Sans rappel, l'écoute expire au bout de ${NOW_PLAYING_TTL_MS / 1000}s.`,
    })
    @ApiResponse({ status: 200, description: 'Écoute enregistrée' })
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    @Put('me')
    async updateMine(@CurrentUser() user: { id: number }, @Body() dto: UpdateListeningDto) {
        return this.listening.set(user.id, dto);
    }

    @ApiOperation({ summary: "Signaler que je n'écoute plus rien" })
    @ApiResponse({ status: 204, description: 'Écoute effacée' })
    @UseGuards(JwtAuthGuard)
    @HttpCode(204)
    @Delete('me')
    async clearMine(@CurrentUser() user: { id: number }) {
        await this.listening.clear(user.id);
    }

    @ApiOperation({ summary: 'Ce que mes amis écoutent en ce moment' })
    @ApiResponse({ status: 200, description: 'Liste des écoutes en cours visibles' })
    @UseGuards(JwtAuthGuard)
    @Get('friends')
    async friendsListening(@CurrentUser() user: { id: number }) {
        return this.listening.getFriendsListening(user.id);
    }
}
