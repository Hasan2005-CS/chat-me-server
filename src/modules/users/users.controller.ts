import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Query,
  Param,
  Req,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UploadService } from '../upload/upload.service';
import { PresenceService } from '../presence/presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from './schemas/user.schema';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: UserDocument;
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
    private readonly presenceService: PresenceService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'hasan' })
  search(@Query('q') query: string, @Req() req: RequestWithUser) {
    return this.usersService.search(query, req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get('blocked')
  @ApiOperation({ summary: 'List users blocked by the current user' })
  getBlockedUsers(@Req() req: RequestWithUser) {
    return this.usersService.getBlockedUsers(req.user._id.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'id', description: 'User id to block' })
  async blockUser(@Req() req: RequestWithUser, @Param('id') id: string) {
    const currentUserId = req.user._id.toString();
    if (id === currentUserId) {
      throw new BadRequestException('You cannot block yourself.');
    }
    await this.usersService.blockUser(currentUserId, id);
    return { blocked: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/block')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'id', description: 'User id to unblock' })
  async unblockUser(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.usersService.unblockUser(req.user._id.toString(), id);
    return { blocked: false };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/presence')
  @ApiOperation({ summary: 'Get a user online status and last seen time' })
  @ApiParam({ name: 'id', type: String })
  async getPresence(@Param('id') id: string) {
    const isOnline = this.presenceService.isOnline(id);
    if (isOnline) {
      return { isOnline: true, lastSeenAt: null };
    }
    const user = await this.usersService.findById(id);
    return { isOnline: false, lastSeenAt: user?.lastSeenAt ?? null };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        displayName: { type: 'string', example: 'Hasan Saaf' },
        bio: { type: 'string', example: 'Building real-time chat apps' },
      },
    },
  })
  updateProfile(
    @Req() req: RequestWithUser,
    @Body() body: { displayName?: string; bio?: string },
  ): Promise<UserDocument | null> {
    return this.usersService.updateProfile(req.user._id.toString(), body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  @ApiOperation({ summary: 'Update the current user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  async updateAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserDocument | null> {
    const { secure_url } = await this.uploadService.uploadFile(
      file.buffer,
      'chat-me/avatars',
      'image',
    );
    return this.usersService.updateAvatar(req.user._id.toString(), secure_url);
  }
}
