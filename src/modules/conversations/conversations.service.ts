import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { UsersService } from '../users/users.service'; // + جديد

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly usersService: UsersService, // + جديد
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
      // المحادثة موجودة أصلاً من قبل الحظر (إذا في حظر) -> منسمح بالوصول
      // ليها، وترك التعامل مع الرسائل الجديدة لمنطق الحظر بمستوى الرسائل.
      return conversation;
    }

    // + جديد: منع إنشاء محادثة مباشرة جديدة إذا في علاقة حظر بأي اتجاه.
    const isBlocked = await this.usersService.isBlockRelated(userIdA, userIdB);
    if (isBlocked) {
      throw new ForbiddenException(
        'Unable to start a conversation with this user.',
      );
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
    for (const memberId of memberIds) {
      const isBlocked = await this.usersService.isBlockRelated(
        adminId,
        memberId,
      );
      if (isBlocked) {
        throw new ForbiddenException(
          'Unable to add one or more of the selected users to this group.',
        );
      }
    }

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

  async search(userId: string, query: string): Promise<ConversationDocument[]> {
    return this.conversationModel
      .find({
        members: new Types.ObjectId(userId),
        name: { $regex: query, $options: 'i' },
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

  private async findGroupAsAdmin(
    conversationId: string,
    adminId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'group')
      throw new BadRequestException('Not a group conversation');
    if (String(conversation.admin) !== adminId)
      throw new ForbiddenException(
        'Only the group admin can perform this action',
      );
    return conversation;
  }

  async addMembers(
    conversationId: string,
    adminId: string,
    memberIds: string[],
  ): Promise<ConversationDocument> {
    await this.findGroupAsAdmin(conversationId, adminId);

    for (const memberId of memberIds) {
      const isBlocked = await this.usersService.isBlockRelated(
        adminId,
        memberId,
      );
      if (isBlocked) {
        throw new ForbiddenException(
          'Unable to add one or more of the selected users to this group.',
        );
      }
    }

    const newMemberOids = memberIds.map((id) => new Types.ObjectId(id));
    return await this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { $addToSet: { members: { $each: newMemberOids } } },
        { new: true },
      )
      .populate('members', 'displayName email avatar');
  }

  async removeMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.type !== 'group')
      throw new BadRequestException('Not a group conversation');

    const isSelf = requesterId === targetUserId;
    const isAdmin = String(conversation.admin) === requesterId;

    if (!isSelf && !isAdmin)
      throw new ForbiddenException('Only the admin can remove other members');

    return await this.conversationModel
      .findByIdAndUpdate(
        conversationId,
        { $pull: { members: new Types.ObjectId(targetUserId) } },
        { new: true },
      )
      .populate('members', 'displayName email avatar');
  }

  async renameGroup(
    conversationId: string,
    adminId: string,
    name: string,
  ): Promise<ConversationDocument> {
    await this.findGroupAsAdmin(conversationId, adminId);
    return await this.conversationModel
      .findByIdAndUpdate(conversationId, { name }, { new: true })
      .populate('members', 'displayName email avatar');
  }
}
