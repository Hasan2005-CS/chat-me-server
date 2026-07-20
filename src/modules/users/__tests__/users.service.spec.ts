import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../users.service';

const mockUserModel = {
  findOne: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
};

describe('UsersService', () => {
  let usersService: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    usersService = new UsersService(mockUserModel as any);
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const mockUser = { id: '123', email: 'test@test.com' };
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByEmail('test@test.com');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@test.com',
      });
    });

    it('should return null if not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await usersService.findByEmail('notfound@test.com');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should return empty array if query is less than 2 characters', async () => {
      const result = await usersService.search('a', '123');
      expect(result).toEqual([]);
    });

    it('should return empty array if query is empty', async () => {
      const result = await usersService.search('', '123');
      expect(result).toEqual([]);
    });

    it('should call find with correct query', async () => {
      const mockUsers = [{ id: '456', displayName: 'Hasan' }];

      mockUserModel.find.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockUsers),
        }),
      });

      const result = await usersService.search('has', '123');

      expect(result).toEqual(mockUsers);
      expect(mockUserModel.find).toHaveBeenCalled();
    });
  });

  describe('findByProvider', () => {
    it('should return user if found', async () => {
      const mockUser = { id: '123', email: 'test@test.com' };
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByProvider('google', 'gid-1');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        'identities.provider': 'google',
        'identities.providerId': 'gid-1',
      });
    });

    it('should return null if not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await usersService.findByProvider('google', 'unknown-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailWithPassword', () => {
    it('should return user with password hash', async () => {
      const mockUser = {
        id: '123',
        email: 'test@test.com',
        passwordHash: 'hash',
      };
      mockUserModel.findOne.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const result =
        await usersService.findByEmailWithPassword('test@test.com');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@test.com',
      });
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      const mockUser = { id: '123', email: 'test@test.com' };
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await usersService.findById('123');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith('123');
    });

    it('should return null if not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await usersService.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return a user', async () => {
      const data = { email: 'test@test.com', displayName: 'Hasan' };
      const mockUser = { id: '123', ...data };
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await usersService.create(data);

      expect(result).toEqual(mockUser);
      expect(mockUserModel.create).toHaveBeenCalledWith(data);
    });
  });

  describe('updateLastSeen', () => {
    it('should call findByIdAndUpdate with lastSeenAt', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await usersService.updateLastSeen('123');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        lastSeenAt: expect.any(Date),
      });
    });
  });

  describe('addIdentity', () => {
    const identity = {
      provider: 'google' as const,
      providerId: 'gid-1',
      email: 'test@test.com',
      accessToken: 'token',
    };

    it('should return updated user when found', async () => {
      const mockUser = { id: '123', identities: [identity] };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await usersService.addIdentity('123', identity);

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        $push: { identities: identity },
      });
    });

    it('should throw Error if user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        usersService.addIdentity('unknown', identity),
      ).rejects.toThrow('User not found');
    });
  });

  describe('findByIdWithRefreshToken', () => {
    it('should return user with refresh token', async () => {
      const mockUser = { id: '123', refreshToken: 'hashed-token' };
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await usersService.findByIdWithRefreshToken('123');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith('123');
    });
  });

  describe('updateRefreshToken', () => {
    it('should hash and store the refresh token when provided', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await usersService.updateRefreshToken('123', 'some-refresh-token');

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      const [id, update] = mockUserModel.findByIdAndUpdate.mock.calls[0];
      expect(id).toBe('123');
      expect(update.refreshToken).toEqual(expect.any(String));
      expect(update.refreshToken).not.toBe('some-refresh-token');
    });

    it('should store null when refreshToken is null', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await usersService.updateRefreshToken('123', null);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        refreshToken: null,
      });
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user', async () => {
      const mockUser = { id: '123', displayName: 'New Name' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await usersService.updateProfile('123', {
        displayName: 'New Name',
      });

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        { displayName: 'New Name' },
        { new: true },
      );
    });
  });

  describe('updateAvatar', () => {
    it('should update and return the user with new avatar', async () => {
      const mockUser = { id: '123', avatar: 'http://example.com/a.png' };
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      });

      const result = await usersService.updateAvatar(
        '123',
        'http://example.com/a.png',
      );

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        { avatar: 'http://example.com/a.png' },
        { new: true },
      );
    });
  });
});
