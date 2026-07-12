import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '../schemas/notification.schema';

const mockNotificationModel = {
  create: vi.fn(),
  insertMany: vi.fn(),
  find: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  updateMany: vi.fn(),
  countDocuments: vi.fn(),
};

describe('NotificationsService', () => {
  let notificationsService: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationsService = new NotificationsService(
      mockNotificationModel as any,
    );
  });

  describe('create', () => {
    it('should call notificationModel.create with recipient, type and payload', async () => {
      const recipientId = new Types.ObjectId().toString();
      const payload = { foo: 'bar' };
      const mockDoc = { id: 'n1' };
      mockNotificationModel.create.mockResolvedValue(mockDoc);

      const result = await notificationsService.create(
        recipientId,
        NotificationType.NEW_MESSAGE,
        payload,
      );

      expect(result).toEqual(mockDoc);
      expect(mockNotificationModel.create).toHaveBeenCalledWith({
        recipient: new Types.ObjectId(recipientId),
        type: NotificationType.NEW_MESSAGE,
        payload,
      });
    });
  });

  describe('notifyNewMessage', () => {
    it('should filter out senderId and insertMany the rest as NEW_MESSAGE notifications', async () => {
      const senderId = new Types.ObjectId().toString();
      const recipient1 = new Types.ObjectId().toString();
      const recipient2 = new Types.ObjectId().toString();
      const memberIds = [senderId, recipient1, recipient2];
      const payload = {
        conversationId: 'c1',
        senderName: 'Hasan',
        preview: 'hello',
      };
      mockNotificationModel.insertMany.mockResolvedValue([]);

      await notificationsService.notifyNewMessage(
        memberIds,
        senderId,
        payload,
      );

      expect(mockNotificationModel.insertMany).toHaveBeenCalledWith([
        {
          recipient: new Types.ObjectId(recipient1),
          type: NotificationType.NEW_MESSAGE,
          payload,
        },
        {
          recipient: new Types.ObjectId(recipient2),
          type: NotificationType.NEW_MESSAGE,
          payload,
        },
      ]);
    });
  });

  describe('findUnread', () => {
    it('should find, sort and limit unread notifications for user', async () => {
      const userId = new Types.ObjectId().toString();
      const mockNotifications = [{ id: 'n1' }, { id: 'n2' }];
      mockNotificationModel.find.mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockNotifications),
      });

      const result = await notificationsService.findUnread(userId);

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationModel.find).toHaveBeenCalledWith({
        recipient: new Types.ObjectId(userId),
        isRead: false,
      });
    });
  });

  describe('markAsRead', () => {
    it('should call findByIdAndUpdate with isRead true', async () => {
      mockNotificationModel.findByIdAndUpdate.mockResolvedValue({});

      await notificationsService.markAsRead('n1');

      expect(mockNotificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'n1',
        { isRead: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should call updateMany with recipient and isRead false filter', async () => {
      const userId = new Types.ObjectId().toString();
      mockNotificationModel.updateMany.mockResolvedValue({});

      await notificationsService.markAllAsRead(userId);

      expect(mockNotificationModel.updateMany).toHaveBeenCalledWith(
        { recipient: new Types.ObjectId(userId), isRead: false },
        { isRead: true },
      );
    });
  });

  describe('countUnread', () => {
    it('should return count of unread notifications', async () => {
      const userId = new Types.ObjectId().toString();
      mockNotificationModel.countDocuments.mockResolvedValue(5);

      const result = await notificationsService.countUnread(userId);

      expect(result).toBe(5);
      expect(mockNotificationModel.countDocuments).toHaveBeenCalledWith({
        recipient: new Types.ObjectId(userId),
        isRead: false,
      });
    });
  });
});
