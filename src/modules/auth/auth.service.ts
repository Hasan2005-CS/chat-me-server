import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
  async registerLocal(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }
    const user = await this.usersService.create({
      displayName: dto.displayName,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 12),
      isVerified: false,
      identities: [
        {
          provider: 'local',
          providerId: dto.email,
          email: dto.email,
        },
      ],
    });
    return this.generateToken(user);
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

  generateToken(user: UserDocument): { accessToken: string } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }
}
