import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';

interface RequestWithUser extends Request {
  user: UserDocument;
}

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('direct')
  createDirect(@Req() req: RequestWithUser, @Body() body: { userId: string }) {
    return this.conversationsService.findOrCreateDirect(
      req.user.id,
      body.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('group')
  createGroup(
    @Req() req: RequestWithUser,
    @Body() body: { name: string; memberIds: string[] },
  ) {
    return this.conversationsService.createGroup(
      body.name,
      req.user.id,
      body.memberIds,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getMyConversations(@Req() req: RequestWithUser) {
    return this.conversationsService.findUserConversations(req.user.id);
  }
}
