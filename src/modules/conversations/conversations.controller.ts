import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
interface RequestWithUser extends Request {
  user: UserDocument;
}

@ApiTags('Conversations')
@ApiBearerAuth('JWT')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('direct')
  @ApiOperation({ summary: 'Create or fetch a direct conversation' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId'],
      properties: {
        userId: { type: 'string', example: '665f2d5c8a1c2a4c7f1e9b10' },
      },
    },
  })
  createDirect(@Req() req: RequestWithUser, @Body() body: { userId: string }) {
    return this.conversationsService.findOrCreateDirect(
      req.user.id,
      body.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('group')
  @ApiOperation({ summary: 'Create a group conversation' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'memberIds'],
      properties: {
        name: { type: 'string', example: 'Project Team' },
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['665f2d5c8a1c2a4c7f1e9b11', '665f2d5c8a1c2a4c7f1e9b12'],
        },
      },
    },
  })
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
  @ApiOperation({ summary: 'Get the current user conversations' })
  getMyConversations(@Req() req: RequestWithUser) {
    return this.conversationsService.findUserConversations(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({
    summary: 'Search the current user group conversations by name',
  })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'Project' })
  search(@Query('q') query: string, @Req() req: RequestWithUser) {
    return this.conversationsService.search(req.user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members')
  @ApiOperation({ summary: 'Add members to a group conversation' })
  @ApiParam({ name: 'id', description: 'Conversation id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['memberIds'],
      properties: {
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['665f2d5c8a1c2a4c7f1e9b13'],
        },
      },
    },
  })
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
  @ApiOperation({ summary: 'Remove a member from a group conversation' })
  @ApiParam({ name: 'id', description: 'Conversation id' })
  @ApiParam({ name: 'userId', description: 'Member user id' })
  removeMember(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.removeMember(id, req.user.id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a group conversation' })
  @ApiParam({ name: 'id', description: 'Conversation id' })
  leaveGroup(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.conversationsService.removeMember(id, req.user.id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/name')
  @ApiOperation({ summary: 'Rename a group conversation' })
  @ApiParam({ name: 'id', description: 'Conversation id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Design Squad' },
      },
    },
  })
  renameGroup(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    return this.conversationsService.renameGroup(id, req.user.id, body.name);
  }
}
