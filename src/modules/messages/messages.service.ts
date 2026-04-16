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
    await this.messageModel.findByIdAndUpdate(
      messageId,
      {
        $set: {
          'receipts.$[elem].status': status,
        },
      },
      {
        arrayFilters: [{ 'elem.user': new Types.ObjectId(userId) }],
      },
    );
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
