import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Message,
  MessageDocument,
  MessageStatus,
} from './schemas/message.schema';

export interface CreateMessageDto {
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video';
  replyTo?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async create(dto: CreateMessageDto): Promise<MessageDocument> {
    return this.messageModel.create({
      conversation: new Types.ObjectId(dto.conversationId),
      sender: new Types.ObjectId(dto.senderId),
      content: dto.content,
      type: dto.type ?? 'text',
      replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : undefined,
      receipts: [
        { user: new Types.ObjectId(dto.senderId), status: MessageStatus.SENT },
      ],
    });
  }

  async findByConversation(
    conversationId: string,
    limit: number = 30,
    before?: string,
  ): Promise<MessageDocument[]> {
    const query: Record<string, unknown> = {
      conversation: new Types.ObjectId(conversationId),
      isDeleted: false,
    };
    if (before) {
      query._id = { $lt: new Types.ObjectId(before) };
    }
    return this.messageModel
      .find(query)
      .populate('sender', 'displayName  avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async updateStatus(messageId: string, userId: string, status: MessageStatus) {
    const userOid = new Types.ObjectId(userId);
    const updated = await this.messageModel.findOneAndUpdate(
      { _id: new Types.ObjectId(messageId), 'receipts.user': userOid },
      { $set: { 'receipts.$.status': status } },
    );
    if (!updated) {
      await this.messageModel.findByIdAndUpdate(messageId, {
        $push: { receipts: { user: userOid, status } },
      });
    }
  }

  async markDelivered(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, string[]>> {
    if (conversationIds.length === 0) return new Map();

    const userOid = new Types.ObjectId(userId);
    const conversationOids = conversationIds.map(
      (id) => new Types.ObjectId(id),
    );

    const messages = await this.messageModel.find(
      {
        conversation: { $in: conversationOids },
        sender: { $ne: userOid },
        'receipts.user': { $ne: userOid },
      },
      '_id conversation',
    );

    if (messages.length === 0) return new Map();

    const messageIds = messages.map((m) => m._id as Types.ObjectId);

    await this.messageModel.updateMany(
      { _id: { $in: messageIds } },
      {
        $push: {
          receipts: { user: userOid, status: MessageStatus.DELIVERED },
        },
      },
    );

    const result = new Map<string, string[]>();
    for (const msg of messages) {
      const convId = msg.conversation.toString();
      if (!result.has(convId)) result.set(convId, []);
      result.get(convId)!.push((msg._id as Types.ObjectId).toString());
    }
    return result;
  }

  async softDelete(messageId: string, senderId: string): Promise<boolean> {
    const result = await this.messageModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(messageId),
        sender: new Types.ObjectId(senderId),
      },
      { isDeleted: true },
    );
    return !!result;
  }
}
