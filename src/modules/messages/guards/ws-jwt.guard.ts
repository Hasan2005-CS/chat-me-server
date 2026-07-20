import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const socket: Socket & { user: unknown } = context.switchToWs().getClient();

    const token =
      (socket.handshake.auth?.token as string) ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    try {
      const payload: unknown = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      }) as unknown;
      (socket as Socket & { user: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
