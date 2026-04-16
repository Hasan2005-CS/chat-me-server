import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(
    recipientId: string,
    type: NotificationType,
    payload: Record<string, unknown>,
  ): Promise<NotificationDocument> {
    return this.notificationModel.create({
      recipient: new Types.ObjectId(recipientId),
      type,
      payload,
    });
  }
  async notifyNewMessage(
    memberIds: string[],
    senderId: string,
    payload: {
      conversationId: string;
      senderName: string;
      preview: string;
    },
  ): Promise<void> {
    const reciptiens = memberIds.filter((id) => id !== senderId);
    const notifications = reciptiens.map((recipientId) => ({
      recipient: new Types.ObjectId(recipientId),
      type: NotificationType.NEW_MESSAGE,
      payload,
    }));
    await this.notificationModel.insertMany(notifications);
  }
  async findUnread(userId: string): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ recipient: new Types.ObjectId(userId), isRead: false })
      .sort({ createdAt: -1 })
      .limit(20);
  }
  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationModel.findByIdAndUpdate(notificationId, {
      isRead: true,
    });
  }
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  }
  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });
  }
}
