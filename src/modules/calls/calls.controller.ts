import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CallsService } from './calls.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';

interface RequestWithUser extends Request {
  user: UserDocument;
}

@ApiTags('Calls')
@ApiBearerAuth('JWT')
@Controller('calls')
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get call history for the current user' })
  @ApiQuery({ name: 'conversationId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @Req() req: RequestWithUser,
    @Query('conversationId') conversationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.callsService.findHistory(
      req.user.id,
      conversationId,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('ice-servers')
  @ApiOperation({ summary: 'Get ICE server config for WebRTC calls' })
  getIceServers() {
    const turnUrls = this.configService.get<string[]>('webrtc.turnUrls', []);
    const turnUsername = this.configService.get<string>(
      'webrtc.turnUsername',
      '',
    );
    const turnCredential = this.configService.get<string>(
      'webrtc.turnCredential',
      '',
    );

    const iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [{ urls: 'stun:stun.l.google.com:19302' }];

    if (turnUrls.length > 0) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return { iceServers };
  }
}
