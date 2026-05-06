import {
  Controller,
  Get,
  Patch,
  Query,
  Req,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from './schemas/user.schema';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
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
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'hasan' })
  search(@Query('q') query: string, @Req() req: RequestWithUser) {
    return this.usersService.search(query, req.user._id.toString());
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
