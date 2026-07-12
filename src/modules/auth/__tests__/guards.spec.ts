import { describe, it, expect } from 'vitest';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import { GitHubAuthGuard } from '../guards/github-auth.guard';

describe('Auth Guards', () => {
  it('JwtAuthGuard should be defined', () => {
    const guard = new JwtAuthGuard();
    expect(guard).toBeDefined();
  });

  it('LocalAuthGuard should be defined', () => {
    const guard = new LocalAuthGuard();
    expect(guard).toBeDefined();
  });

  it('GoogleAuthGuard should be defined', () => {
    const guard = new GoogleAuthGuard();
    expect(guard).toBeDefined();
  });

  it('GitHubAuthGuard should be defined', () => {
    const guard = new GitHubAuthGuard();
    expect(guard).toBeDefined();
  });
});
