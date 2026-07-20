import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

const mockAuthService = {
  registerLocal: vi.fn(),
  generateTokens: vi.fn(),
  refreshTokens: vi.fn(),
  logout: vi.fn(),
};

const mockConfigService = {
  getOrThrow: vi.fn((key: string) => {
    const config: Record<string, string> = {
      frontendUrl: 'http://localhost:5173',
    };
    return config[key];
  }),
};

describe('AuthController', () => {
  let authController: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();

    authController = new AuthController(
      mockAuthService as unknown as AuthService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('should call authService.registerLocal with dto and res', async () => {
      const dto = {
        displayName: 'Hasan',
        email: 'hasansaafen1234@gmail.com',
        password: 'password',
      };
      const res = { cookie: vi.fn() };
      mockAuthService.registerLocal.mockResolvedValue({
        accessToken: 'access-token',
      });

      const result = await authController.register(dto as any, res as any);

      expect(mockAuthService.registerLocal).toHaveBeenCalledWith(dto, res);
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('login', () => {
    it('should call authService.generateTokens with req.user and res', async () => {
      const req = { user: { id: '123' } };
      const res = { cookie: vi.fn() };
      mockAuthService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
      });

      const result = await authController.login(req as any, res as any);

      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        req.user,
        res,
      );
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('refresh', () => {
    it('should call authService.refreshTokens with token from cookie', async () => {
      const req = { cookies: { refresh_token: 'refresh-token' } };
      const res = { cookie: vi.fn() };
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'access-token',
      });

      const result = await authController.refresh(req as any, res as any);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        'refresh-token',
        res,
      );
      expect(result).toEqual({ accessToken: 'access-token' });
    });

    it('should throw UnauthorizedException if no refresh token cookie present', async () => {
      const req = { cookies: {} };
      const res = { cookie: vi.fn() };

      expect(() => authController.refresh(req as any, res as any)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if cookies object is undefined', async () => {
      const req = {};
      const res = { cookie: vi.fn() };

      expect(() => authController.refresh(req as any, res as any)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should call authService.logout with req.user.id and res', async () => {
      const req = { user: { id: '123' } };
      const res = { clearCookie: vi.fn() };
      mockAuthService.logout.mockResolvedValue({
        message: 'Log out successfully!',
      });

      const result = await authController.logout(req as any, res as any);

      expect(mockAuthService.logout).toHaveBeenCalledWith('123', res);
      expect(result).toEqual({ message: 'Log out successfully!' });
    });
  });

  describe('googleCallback', () => {
    it('should redirect to frontend oauth callback on success', async () => {
      const req = { user: { id: '123' } };
      const res = { cookie: vi.fn(), redirect: vi.fn() };
      mockAuthService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
      });

      await authController.googleCallback(req as any, res as any);

      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        req.user,
        res,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/oauth/callback',
      );
    });

    it('should redirect to error page when generateTokens throws', async () => {
      const req = { user: { id: '123' } };
      const res = { cookie: vi.fn(), redirect: vi.fn() };
      mockAuthService.generateTokens.mockRejectedValueOnce(new Error('boom'));

      await authController.googleCallback(req as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/oauth/callback?error=oauth_failed',
      );
    });
  });

  describe('githubCallback', () => {
    it('should redirect to frontend oauth callback on success', async () => {
      const req = { user: { id: '123' } };
      const res = { cookie: vi.fn(), redirect: vi.fn() };
      mockAuthService.generateTokens.mockResolvedValue({
        accessToken: 'access-token',
      });

      await authController.githubCallback(req as any, res as any);

      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        req.user,
        res,
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/oauth/callback',
      );
    });

    it('should redirect to error page when generateTokens throws', async () => {
      const req = { user: { id: '123' } };
      const res = { cookie: vi.fn(), redirect: vi.fn() };
      mockAuthService.generateTokens.mockRejectedValueOnce(new Error('boom'));

      await authController.githubCallback(req as any, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/oauth/callback?error=oauth_failed',
      );
    });
  });

  describe('oauth start endpoints', () => {
    it('googleAuth is a guarded no-op', () => {
      expect(authController.googleAuth()).toBeUndefined();
    });

    it('githubAuth is a guarded no-op', () => {
      expect(authController.githubAuth()).toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('should return req.user', () => {
      const req = { user: { id: '123', email: 'test@test.com' } };

      const result = authController.getMe(req as any);

      expect(result).toBe(req.user);
    });
  });
});
