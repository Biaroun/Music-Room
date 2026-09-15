import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';

// the /subscription routes
@ApiTags('subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
    constructor(private subscription: SubscriptionService) {}

    // POST subscribe to premium
    @ApiOperation({ summary: 'Subscribe to Premium (no payment, confirmation only)' })
    @ApiResponse({ status: 409, description: 'Already subscribed' })
    @Post('subscribe')
    async subscribe(@CurrentUser() user: { id: number }) {
        const updated = await this.subscription.subscribe(user.id);
        return { plan: updated.plan, subscribedAt: updated.subscribedAt };
    }

    // POST cancel premium
    @ApiOperation({ summary: 'Cancel my Premium subscription' })
    @ApiResponse({ status: 409, description: 'No active subscription' })
    @Post('cancel')
    async cancel(@CurrentUser() user: { id: number }) {
        const updated = await this.subscription.cancel(user.id);
        return { plan: updated.plan, subscribedAt: updated.subscribedAt };
    }
}
