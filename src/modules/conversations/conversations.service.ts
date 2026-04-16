import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async findOrCreateDirect(
    userIdA: string,
    userIdB: string,
  ): Promise<ConversationDocument> {
    const memberA = new Types.ObjectId(userIdA);
    const memberB = new Types.ObjectId(userIdB);

    let conversation = await this.conversationModel.findOne({
      type: 'direct',
      members: { $all: [memberA, memberB] },
    });
    if (conversation) {
      return conversation;
    }
    conversation = await this.conversationModel.create({
      type: 'direct',
      members: [memberA, memberB],
    });
    return conversation;
  }
  async createGroup(
    name: string,
    adminId: string,
    memberIds: string[],
  ): Promise<ConversationDocument> {
    const allMembers = [
      new Types.ObjectId(adminId),
      ...memberIds.map((id) => new Types.ObjectId(id)),
    ];
    return this.conversationModel.create({
      type: 'group',
      name,
      admin: new Types.ObjectId(adminId),
      members: allMembers,
    });
  }

  async findUserConversations(userId: string): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        members: new Types.ObjectId(userId),
      })
      .populate('members', 'displayName email avatar')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });
  }

  async updateLastMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: new Types.ObjectId(messageId),
      lastMessageAt: new Date(),
    });
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationModel.findOne({
      _id: new Types.ObjectId(conversationId),
      members: new Types.ObjectId(userId),
    });
    return !!conversation;
  }
  async findById(id: string): Promise<ConversationDocument | null> {
    return this.conversationModel.findById(id);
  }
}
