import { Controller, Get, Req, Param, Patch, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationDocument } from './schemas/notification.schema';
interface RequestWithUser extends Request {
  user: UserDocument;
}
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUnread(
    @Req() req: RequestWithUser,
  ): Promise<NotificationDocument[]> {
    const userId = String(req.user._id);
    return this.notificationsService.findUnread(userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('count')
  getCount(@Req() req: RequestWithUser) {
    return this.notificationsService.countUnread(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
