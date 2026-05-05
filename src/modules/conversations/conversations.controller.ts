import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members')
  addMembers(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { memberIds: string[] },
  ) {
    return this.conversationsService.addMembers(
      id,
      req.user.id,
      body.memberIds,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.removeMember(id, req.user.id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/name')
  renameGroup(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.conversationsService.renameGroup(id, req.user.id, body.name);
  }
}
