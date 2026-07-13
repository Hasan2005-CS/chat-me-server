import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsersService = {
  findByEmail: vi.fn(),
  findByEmailWithPassword: vi.fn(),
  findByProvider: vi.fn(),
  findByIdWithRefreshToken: vi.fn(),
  create: vi.fn(),
  updateRefreshToken: vi.fn(),
  updateLastSeen: vi.fn(),
  addIdentity: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(),
  verify: vi.fn(),
};

const mockConfigService = {
  getOrThrow: vi.fn((key: string) => {
    const config: Record<string, string> = {
      'jwt.secret': 'test-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
    };
    return config[key];
  }),
  get: vi.fn((key: string) => {
    const config: Record<string, string | undefined> = {
      nodeEnv: 'test',
      cookieDomain: undefined,
    };
    return config[key];
  }),
};
const mockResponse = {
  cookie: vi.fn(),
  clearCookie: vi.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    authService = new AuthService(
      mockUsersService as unknown as UsersService,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
    );
  });
  describe('validateLocalUser', () => {
    it('should retrun null if user not found', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue(null);
      const result = await authService.validateLocalUser(
        'hasansaafen1234@gmail.com',
        'password',
      );
      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValue({
        passwordHash: await bcrypt.hash('correct-password', 10),
      });
      const result = await authService.validateLocalUser(
        'hasansaafen1234@gmail.com',
        'incorrect-password',
      );
      expect(result).toBeNull();
    });
    it('should return user if credentials are valid', async () => {
      const password = 'Test1234';
      const passwordHash = await bcrypt.hash(password, 10);

      mockUsersService.findByEmailWithPassword.mockResolvedValue({
        id: '123',
        email: 'test@test.com',
        passwordHash,
      });

      const result = await authService.validateLocalUser(
        'test@test.com',
        password,
      );

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@test.com');
    });
  });
  describe('registerLocal', () => {
    it('should throw ConflictException if email is already in use', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '123' });
      await expect(
        authService.registerLocal(
          {
            displayName: 'Hasan',
            email: 'hasansaafen1234@gmail.com',
            password: 'password',
          },
          mockResponse as unknown as any,
        ),
      ).rejects.toThrow(ConflictException);
    });
    it('should create user and return access token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: '123',
        displayName: 'Hasan',
        email: 'hasansaafen1234@gmail.com',
      });
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await authService.registerLocal(
        {
          displayName: 'Hasan',
          email: 'hasansaafen1234@gmail.com',
          password: 'password',
        },
        mockResponse as unknown as any,
      );

      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });
  it('should clear refresh token and cookie', async () => {
    mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

    await authService.logout('123', mockResponse as any);

    expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
      '123',
      null,
    );
    expect(mockResponse.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.any(Object),
    );
  });
  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(
        authService.refreshTokens('invalid-token', mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: '123',
        email: 'test@test.com',
      });
      mockUsersService.findByIdWithRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refreshTokens('valid-token', mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return new token pair when refresh token matches stored hash', async () => {
      const refreshToken = 'valid-refresh-token';
      const storedHash = await bcrypt.hash(refreshToken, 10);

      mockJwtService.verify.mockReturnValue({
        sub: '123',
        email: 'test@test.com',
      });
      mockUsersService.findByIdWithRefreshToken.mockResolvedValue({
        id: '123',
        email: 'test@test.com',
        refreshToken: storedHash,
      });
      mockJwtService.sign.mockReturnValue('new-access-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refreshTokens(
        refreshToken,
        mockResponse as any,
      );

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-access-token',
        expect.any(Object),
      );
    });

    it('should throw UnauthorizedException when stored hash does not match refresh token', async () => {
      const storedHash = await bcrypt.hash('some-other-token', 10);

      mockJwtService.verify.mockReturnValue({
        sub: '123',
        email: 'test@test.com',
      });
      mockUsersService.findByIdWithRefreshToken.mockResolvedValue({
        id: '123',
        email: 'test@test.com',
        refreshToken: storedHash,
      });

      await expect(
        authService.refreshTokens('valid-refresh-token', mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens', () => {
    it('should sign access and refresh tokens, update refresh token, set cookie, and return access token', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const user = { id: '123', email: 'test@test.com' };
      const result = await authService.generateTokens(
        user as any,
        mockResponse as any,
      );

      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        '123',
        'refresh-token',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('findOrCreateOAuthUser', () => {
    const profile = {
      provider: 'google' as const,
      providerId: 'gid-123',
      email: 'oauth@test.com',
      displayName: 'OAuth User',
      avatar: 'http://x/avatar.png',
      accessToken: 'oauth-access-token',
    };

    it('should return existing user found by provider and update last seen', async () => {
      const existingUser = { id: '123', email: profile.email };
      mockUsersService.findByProvider.mockResolvedValue(existingUser);
      mockUsersService.updateLastSeen.mockResolvedValue(undefined);

      const result = await authService.findOrCreateOAuthUser(profile);

      expect(mockUsersService.findByProvider).toHaveBeenCalledWith(
        profile.provider,
        profile.providerId,
      );
      expect(mockUsersService.updateLastSeen).toHaveBeenCalledWith('123');
      expect(result).toBe(existingUser);
    });

    it('should add identity to existing user found by email when not found by provider', async () => {
      const existingUser = { id: '456', email: profile.email };
      const updatedUser = { id: '456', email: profile.email, identities: [] };
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(existingUser);
      mockUsersService.addIdentity.mockResolvedValue(updatedUser);

      const result = await authService.findOrCreateOAuthUser(profile);

      expect(mockUsersService.addIdentity).toHaveBeenCalledWith('456', {
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        accessToken: profile.accessToken,
      });
      expect(result).toBe(updatedUser);
    });

    it('should create a new user when not found by provider or email', async () => {
      const createdUser = { id: '789', email: profile.email };
      mockUsersService.findByProvider.mockResolvedValue(null);
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(createdUser);

      const result = await authService.findOrCreateOAuthUser(profile);

      expect(mockUsersService.create).toHaveBeenCalledWith({
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
      expect(result).toBe(createdUser);
    });
  });
});
