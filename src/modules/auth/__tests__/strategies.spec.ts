import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { LocalStrategy } from '../strategies/local.strategy';
import { GoogleStrategy } from '../strategies/google.strategy';
import { GitHubStrategy } from '../strategies/github.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'secret',
      };
      return config[key];
    }),
  };
  const mockUsersService = {
    findById: vi.fn(),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'secret',
      };
      return config[key];
    });
    strategy = new JwtStrategy(
      mockConfigService as unknown as ConfigService,
      mockUsersService as unknown as UsersService,
    );
  });

  it('should return the user when found and active', async () => {
    const user = { id: '123', isActive: true };
    mockUsersService.findById.mockResolvedValue(user);

    const result = await strategy.validate({
      sub: '123',
      email: 'test@test.com',
    });

    expect(result).toBe(user);
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockUsersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: '123', email: 'test@test.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when user is not active', async () => {
    mockUsersService.findById.mockResolvedValue({
      id: '123',
      isActive: false,
    });

    await expect(
      strategy.validate({ sub: '123', email: 'test@test.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe('LocalStrategy', () => {
  const mockAuthService = {
    validateLocalUser: vi.fn(),
  };

  let strategy: LocalStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new LocalStrategy(mockAuthService as unknown as AuthService);
  });

  it('should return the user when valid', async () => {
    const user = { id: '123', email: 'test@test.com' };
    mockAuthService.validateLocalUser.mockResolvedValue(user);

    const result = await strategy.validate('test@test.com', 'password');

    expect(mockAuthService.validateLocalUser).toHaveBeenCalledWith(
      'test@test.com',
      'password',
    );
    expect(result).toBe(user);
  });

  it('should throw UnauthorizedException when user is null', async () => {
    mockAuthService.validateLocalUser.mockResolvedValue(null);

    await expect(
      strategy.validate('test@test.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe('GoogleStrategy', () => {
  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        'google.clientId': 'client-id',
        'google.clientSecret': 'client-secret',
        'google.callbackUrl': 'http://localhost:3000/callback',
      };
      return config[key];
    }),
  };
  const mockAuthService = {
    findOrCreateOAuthUser: vi.fn(),
  };

  let strategy: GoogleStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'google.clientId': 'client-id',
        'google.clientSecret': 'client-secret',
        'google.callbackUrl': 'http://localhost:3000/callback',
      };
      return config[key];
    });
    strategy = new GoogleStrategy(
      mockConfigService as unknown as ConfigService,
      mockAuthService as unknown as AuthService,
    );
  });

  it('should call findOrCreateOAuthUser with mapped profile fields', async () => {
    const profile = {
      id: '1',
      emails: [{ value: 'a@b.com' }],
      displayName: 'A',
      photos: [{ value: 'http://x/avatar.png' }],
    };
    const user = { id: '123' };
    mockAuthService.findOrCreateOAuthUser.mockResolvedValue(user);

    const result = await strategy.validate(
      'access-token',
      'refresh-token',
      profile as any,
    );

    expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
      provider: 'google',
      providerId: '1',
      email: 'a@b.com',
      displayName: 'A',
      avatar: 'http://x/avatar.png',
      accessToken: 'access-token',
    });
    expect(result).toBe(user);
  });

  it('should default email and avatar when emails/photos are missing', async () => {
    const profile = { id: '1', displayName: 'A' };
    const user = { id: '123' };
    mockAuthService.findOrCreateOAuthUser.mockResolvedValue(user);

    await strategy.validate('access-token', 'refresh-token', profile as any);

    expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
      provider: 'google',
      providerId: '1',
      email: '',
      displayName: 'A',
      avatar: undefined,
      accessToken: 'access-token',
    });
  });
});

describe('GitHubStrategy', () => {
  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config: Record<string, string> = {
        'github.clientId': 'client-id',
        'github.clientSecret': 'client-secret',
        'github.callbackUrl': 'http://localhost:3000/callback',
      };
      return config[key];
    }),
  };
  const mockAuthService = {
    findOrCreateOAuthUser: vi.fn(),
  };

  let strategy: GitHubStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        'github.clientId': 'client-id',
        'github.clientSecret': 'client-secret',
        'github.callbackUrl': 'http://localhost:3000/callback',
      };
      return config[key];
    });
    strategy = new GitHubStrategy(
      mockConfigService as unknown as ConfigService,
      mockAuthService as unknown as AuthService,
    );
  });

  it('should call findOrCreateOAuthUser with mapped profile fields', async () => {
    const profile = {
      id: '1',
      emails: [{ value: 'a@b.com' }],
      displayName: 'A',
      photos: [{ value: 'http://x/avatar.png' }],
    };
    const user = { id: '123' };
    mockAuthService.findOrCreateOAuthUser.mockResolvedValue(user);

    const result = await strategy.validate(
      'access-token',
      'refresh-token',
      profile as any,
    );

    expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
      provider: 'github',
      providerId: '1',
      email: 'a@b.com',
      displayName: 'A',
      avatar: 'http://x/avatar.png',
      accessToken: 'access-token',
    });
    expect(result).toBe(user);
  });

  it('should fall back to profile.username when displayName is undefined', async () => {
    const profile = {
      id: '2',
      emails: [{ value: 'c@d.com' }],
      displayName: undefined,
      username: 'octocat',
      photos: [{ value: 'http://x/avatar2.png' }],
    };
    const user = { id: '456' };
    mockAuthService.findOrCreateOAuthUser.mockResolvedValue(user);

    const result = await strategy.validate(
      'access-token',
      'refresh-token',
      profile as any,
    );

    expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
      provider: 'github',
      providerId: '2',
      email: 'c@d.com',
      displayName: 'octocat',
      avatar: 'http://x/avatar2.png',
      accessToken: 'access-token',
    });
    expect(result).toBe(user);
  });

  it('should default email and avatar when emails/photos are missing', async () => {
    const profile = { id: '3', displayName: 'C' };
    const user = { id: '789' };
    mockAuthService.findOrCreateOAuthUser.mockResolvedValue(user);

    await strategy.validate('access-token', 'refresh-token', profile as any);

    expect(mockAuthService.findOrCreateOAuthUser).toHaveBeenCalledWith({
      provider: 'github',
      providerId: '3',
      email: '',
      displayName: 'C',
      avatar: undefined,
      accessToken: 'access-token',
    });
  });
});
