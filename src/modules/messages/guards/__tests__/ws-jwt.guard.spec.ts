import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { WsJwtGuard } from '../ws-jwt.guard';

const mockJwtService = {
  verify: vi.fn(),
};

const mockConfigService = {
  getOrThrow: vi.fn().mockReturnValue('secret'),
};

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('secret');
    guard = new WsJwtGuard(mockJwtService as any, mockConfigService as any);
  });

  const buildContext = (socket: any) =>
    ({
      switchToWs: () => ({
        getClient: () => socket,
      }),
    }) as any;

  it('should authenticate using token from handshake.auth.token', () => {
    const socket: any = {
      handshake: { auth: { token: 'auth-token' }, headers: {} },
      user: undefined,
    };
    mockJwtService.verify.mockReturnValue({ sub: '123', email: 'a@b.com' });

    const result = guard.canActivate(buildContext(socket));

    expect(result).toBe(true);
    expect(socket.user).toEqual({ sub: '123', email: 'a@b.com' });
    expect(mockJwtService.verify).toHaveBeenCalledWith('auth-token', {
      secret: 'secret',
    });
  });

  it('should authenticate using token from Authorization header when auth.token is absent', () => {
    const socket: any = {
      handshake: {
        auth: {},
        headers: { authorization: 'Bearer header-token' },
      },
      user: undefined,
    };
    mockJwtService.verify.mockReturnValue({ sub: '456', email: 'c@d.com' });

    const result = guard.canActivate(buildContext(socket));

    expect(result).toBe(true);
    expect(socket.user).toEqual({ sub: '456', email: 'c@d.com' });
    expect(mockJwtService.verify).toHaveBeenCalledWith('header-token', {
      secret: 'secret',
    });
  });

  it('should throw UnauthorizedException("No token provided") when no token is present', () => {
    const socket: any = {
      handshake: { auth: {}, headers: {} },
      user: undefined,
    };

    expect(() => guard.canActivate(buildContext(socket))).toThrow(
      new UnauthorizedException('No token provided'),
    );
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException("Invalid token") when jwtService.verify throws', () => {
    const socket: any = {
      handshake: { auth: { token: 'bad-token' }, headers: {} },
      user: undefined,
    };
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    expect(() => guard.canActivate(buildContext(socket))).toThrow(
      new UnauthorizedException('Invalid token'),
    );
  });
});
