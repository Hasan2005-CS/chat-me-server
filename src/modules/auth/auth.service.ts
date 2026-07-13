import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  displayName: string;
  avatar?: string;
  accessToken: string;
}

export interface TokenPair {
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateLocalUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !user.passwordHash) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return user;
  }

  async registerLocal(dto: RegisterDto, res: Response): Promise<TokenPair> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('The Email you provided is already exist!');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.usersService.create({
      displayName: dto.displayName,
      email: dto.email,
      passwordHash,
      isVerified: false,
      identities: [
        { provider: 'local', providerId: dto.email, email: dto.email },
      ],
    });

    return this.generateTokens(user, res);
  }

  async findOrCreateOAuthUser(profile: OAuthProfile): Promise<UserDocument> {
    let user = await this.usersService.findByProvider(
      profile.provider,
      profile.providerId,
    );
    if (user) {
      await this.usersService.updateLastSeen(user.id);
      return user;
    }

    user = await this.usersService.findByEmail(profile.email);
    if (user) {
      return this.usersService.addIdentity(user.id, {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        accessToken: profile.accessToken,
      });
    }

    return this.usersService.create({
      displayName: profile.displayName,
      email: profile.email,
      avatar: profile.avatar,
      isVerified: true,
      identities: [
        {
          provider: profile.provider,
          providerId: profile.providerId,
          email: profile.email,
          accessToken: profile.accessToken,
        },
      ],
    });
  }

  async generateTokens(user: UserDocument, res: Response): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: '7d',
    });

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    res.cookie('refresh_token', refreshToken, {
      ...this.refreshCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return { accessToken };
  }

  private refreshCookieOptions() {
    const isProduction = this.configService.get('nodeEnv') === 'production';
    const domain = this.configService.get<string | undefined>('cookieDomain');

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      ...(domain ? { domain } : {}),
    };
  }

  async refreshTokens(refreshToken: string, res: Response): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('The session ended login again!');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('The session ended login again!');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('The session ended login again!');
    }

    return this.generateTokens(user, res);
  }

  async logout(userId: string, res: Response): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, null);

    res.clearCookie('refresh_token', this.refreshCookieOptions());

    return { message: 'Log out successfully!' };
  }
}
