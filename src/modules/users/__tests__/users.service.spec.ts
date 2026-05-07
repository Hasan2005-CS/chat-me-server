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
});
