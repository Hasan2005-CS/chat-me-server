import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { email } from 'zod/v4';

interface RequestWithUser extends Request {
  user: UserDocument;
}
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.registerLocal(dto, res);
  }

  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({
    schema: {
      properties: {
        email:    { type: 'string', example: 'hasansaafen1234@gmail.com' },
        password: { type: 'string', example: 'Password123!' },
      },
    },
  })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.generateTokens(req.user, res);
  }
  @ApiOperation({ summary: 'Refresh access token' })
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new UnauthorizedException('No refresh token');
    return this.authService.refreshTokens(token, res);
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req.user.id, res);
  }

  @ApiOperation({ summary: 'Google Auth' })
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleAuth() {}

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  googleCallback(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.generateTokens(req.user, res);
  }

  @ApiOperation({ summary: 'GitHub Auth' })
  @UseGuards(GitHubAuthGuard)
  @Get('github')
  githubAuth() {}

  @UseGuards(GitHubAuthGuard)
  @Get('github/callback')
  githubCallback(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.generateTokens(req.user, res);
  }

  @ApiOperation({ summary: 'Get current user' })
  @ApiBearerAuth('JWT')
    @UseGuards(JwtAuthGuard)

  @Get('me')
  getMe(@Req() req: RequestWithUser) {
    return req.user;
  }
}
