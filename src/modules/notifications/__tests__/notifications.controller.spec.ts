import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from '../notifications.controller';

const mockNotificationsService = {
  findUnread: vi.fn(),
  countUnread: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
};

describe('NotificationsController', () => {
  let notificationsController: NotificationsController;
  const req = { user: { _id: 'u1', id: 'u1' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationsController = new NotificationsController(
      mockNotificationsService as any,
    );
  });

  describe('getUnread', () => {
    it('should call notificationsService.findUnread with user id', async () => {
      const mockResult = [{ id: 'n1' }];
      mockNotificationsService.findUnread.mockResolvedValue(mockResult);

      const result = await notificationsController.getUnread(req);

      expect(result).toEqual(mockResult);
      expect(mockNotificationsService.findUnread).toHaveBeenCalledWith(
        String(req.user._id),
      );
    });
  });

  describe('getCount', () => {
    it('should call notificationsService.countUnread with user id', () => {
      mockNotificationsService.countUnread.mockResolvedValue(3);

      const result = notificationsController.getCount(req);

      expect(result).resolves.toBe(3);
      expect(mockNotificationsService.countUnread).toHaveBeenCalledWith(
        req.user.id,
      );
    });
  });

  describe('markAsRead', () => {
    it('should call notificationsService.markAsRead with id', () => {
      mockNotificationsService.markAsRead.mockResolvedValue(undefined);

      notificationsController.markAsRead('n1');

      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith('n1');
    });
  });

  describe('markAllAsRead', () => {
    it('should call notificationsService.markAllAsRead with user id', () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue(undefined);

      notificationsController.markAllAsRead(req);

      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(
        req.user.id,
      );
    });
  });
});
