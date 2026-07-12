import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UploadService } from '../../upload/upload.service';

const mockUsersService = {
  search: vi.fn(),
  updateProfile: vi.fn(),
  updateAvatar: vi.fn(),
};

const mockUploadService = {
  uploadFile: vi.fn(),
};

describe('UsersController', () => {
  let usersController: UsersController;

  beforeEach(() => {
    vi.clearAllMocks();
    usersController = new UsersController(
      mockUsersService as unknown as UsersService,
      mockUploadService as unknown as UploadService,
    );
  });

  describe('search', () => {
    it('should call usersService.search with query and current user id', () => {
      const mockUsers = [{ id: '456', displayName: 'Hasan' }];
      mockUsersService.search.mockReturnValue(mockUsers);
      const req = { user: { _id: '123' } } as any;

      const result = usersController.search('has', req);

      expect(result).toEqual(mockUsers);
      expect(mockUsersService.search).toHaveBeenCalledWith('has', '123');
    });
  });

  describe('updateProfile', () => {
    it('should call usersService.updateProfile with current user id and body', () => {
      const mockUser = { id: '123', displayName: 'New Name' };
      mockUsersService.updateProfile.mockReturnValue(mockUser);
      const req = { user: { _id: '123' } } as any;
      const body = { displayName: 'New Name' };

      const result = usersController.updateProfile(req, body);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        '123',
        body,
      );
    });
  });

  describe('updateAvatar', () => {
    it('should upload the file and update the user avatar', async () => {
      const req = { user: { _id: '123' } } as any;
      const file = { buffer: Buffer.from('image-data') } as any;
      mockUploadService.uploadFile.mockResolvedValue({
        secure_url: 'http://example.com/avatar.png',
      });
      const mockUser = { id: '123', avatar: 'http://example.com/avatar.png' };
      mockUsersService.updateAvatar.mockResolvedValue(mockUser);

      const result = await usersController.updateAvatar(req, file);

      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        file.buffer,
        'chat-me/avatars',
        'image',
      );
      expect(mockUsersService.updateAvatar).toHaveBeenCalledWith(
        '123',
        'http://example.com/avatar.png',
      );
      expect(result).toEqual(mockUser);
    });
  });
});
