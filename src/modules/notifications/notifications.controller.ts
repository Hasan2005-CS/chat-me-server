import { Controller, Get, Req, Param, Patch, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationDocument } from './schemas/notification.schema';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
interface RequestWithUser extends Request {
  user: UserDocument;
}

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get unread notifications' })
  async getUnread(
    @Req() req: RequestWithUser,
  ): Promise<NotificationDocument[]> {
    const userId = String(req.user._id);
    return this.notificationsService.findUnread(userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getCount(@Req() req: RequestWithUser) {
    return this.notificationsService.countUnread(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification id' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
