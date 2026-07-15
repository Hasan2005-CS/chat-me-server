import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: UserDocument;
}

@ApiTags('Messages')
@ApiBearerAuth('JWT')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation id' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const isMember = await this.conversationsService.isMember(
      conversationId,
      req.user.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You are not a member of this conversation.',
      );
    }

    return this.messagesService.findByConversation(
      conversationId,
      req.user.id,
      limit ? Number(limit) : undefined,
      before,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':conversationId/search')
  @ApiOperation({ summary: 'Search messages within a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation id' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'hello' })
  async searchMessages(
    @Req() req: RequestWithUser,
    @Param('conversationId') conversationId: string,
    @Query('q') query: string,
  ) {
    const isMember = await this.conversationsService.isMember(
      conversationId,
      req.user.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You are not a member of this conversation.',
      );
    }

    return this.messagesService.search(conversationId, query);
  }
}
