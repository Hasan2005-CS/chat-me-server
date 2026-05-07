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
    expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
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
  });
});
