import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConversationsService } from '../conversations.service';

const mockConversationModel = {
  findOne: vi.fn(),
  create: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
};

describe('ConversationsService', () => {
  let conversationsService: ConversationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    conversationsService = new ConversationsService(
      mockConversationModel as any,
    );
  });

  describe('findOrCreateDirect', () => {
    it('should return existing conversation if found', async () => {
      const mockConversation = { id: 'c1', type: 'direct' };
      mockConversationModel.findOne.mockResolvedValue(mockConversation);

      const result = await conversationsService.findOrCreateDirect(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toEqual(mockConversation);
      expect(mockConversationModel.findOne).toHaveBeenCalled();
      expect(mockConversationModel.create).not.toHaveBeenCalled();
    });

    it('should create a new conversation if not found', async () => {
      const mockConversation = { id: 'c2', type: 'direct' };
      mockConversationModel.findOne.mockResolvedValue(null);
      mockConversationModel.create.mockResolvedValue(mockConversation);

      const result = await conversationsService.findOrCreateDirect(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toEqual(mockConversation);
      expect(mockConversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'direct' }),
      );
    });
  });

  describe('createGroup', () => {
    it('should call create with type group, admin, and members', async () => {
      const mockConversation = { id: 'g1', type: 'group' };
      mockConversationModel.create.mockResolvedValue(mockConversation);

      const result = await conversationsService.createGroup(
        'Team',
        '507f1f77bcf86cd799439011',
        ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
      );

      expect(result).toEqual(mockConversation);
      const createArg = mockConversationModel.create.mock.calls[0][0];
      expect(createArg.type).toBe('group');
      expect(createArg.name).toBe('Team');
      expect(createArg.members).toHaveLength(3);
    });
  });

  describe('findUserConversations', () => {
    it('should return the sorted, populated conversations', async () => {
      const mockConversations = [{ id: 'c1' }, { id: 'c2' }];
      const sort = vi.fn().mockResolvedValue(mockConversations);
      const populate = vi.fn().mockReturnThis();
      mockConversationModel.find.mockReturnValue({
        populate,
        sort,
      });

      const result = await conversationsService.findUserConversations(
        '507f1f77bcf86cd799439011',
      );

      expect(result).toEqual(mockConversations);
      expect(mockConversationModel.find).toHaveBeenCalled();
    });
  });

  describe('updateLastMessage', () => {
    it('should call findByIdAndUpdate with lastMessage and lastMessageAt', async () => {
      mockConversationModel.findByIdAndUpdate.mockResolvedValue(undefined);

      await conversationsService.updateLastMessage(
        'convo1',
        '507f1f77bcf86cd799439011',
      );

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'convo1',
        expect.objectContaining({
          lastMessage: expect.anything(),
          lastMessageAt: expect.any(Date),
        }),
      );
    });
  });

  describe('isMember', () => {
    it('should return true when a matching conversation exists', async () => {
      mockConversationModel.findOne.mockResolvedValue({ id: 'c1' });

      const result = await conversationsService.isMember(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toBe(true);
    });

    it('should return false when no matching conversation exists', async () => {
      mockConversationModel.findOne.mockResolvedValue(null);

      const result = await conversationsService.isMember(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toBe(false);
    });
  });

  describe('findById', () => {
    it('should call findById on the model', async () => {
      const mockConversation = { id: 'c1' };
      mockConversationModel.findById.mockResolvedValue(mockConversation);

      const result = await conversationsService.findById('c1');

      expect(result).toEqual(mockConversation);
      expect(mockConversationModel.findById).toHaveBeenCalledWith('c1');
    });
  });

  describe('addMembers', () => {
    it('should add members when requester is the admin', async () => {
      const conversation = {
        id: 'g1',
        type: 'group',
        admin: 'admin1',
      };
      const updated = { id: 'g1', type: 'group', members: ['admin1', 'u2'] };
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockConversationModel.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updated),
      });

      const result = await conversationsService.addMembers('g1', 'admin1', [
        '507f1f77bcf86cd799439012',
      ]);

      expect(result).toEqual(updated);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      mockConversationModel.findById.mockResolvedValue(null);

      await expect(
        conversationsService.addMembers('missing', 'admin1', ['u2']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not a group conversation', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'c1',
        type: 'direct',
        admin: 'admin1',
      });

      await expect(
        conversationsService.addMembers('c1', 'admin1', ['u2']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when requester is not the admin', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'g1',
        type: 'group',
        admin: 'admin1',
      });

      await expect(
        conversationsService.addMembers('g1', 'not-admin', ['u2']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('should throw NotFoundException when conversation does not exist', async () => {
      mockConversationModel.findById.mockResolvedValue(null);

      await expect(
        conversationsService.removeMember('missing', 'u1', 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not a group conversation', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'c1',
        type: 'direct',
        admin: 'admin1',
      });

      await expect(
        conversationsService.removeMember('c1', 'admin1', 'u2'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when requester is neither self nor admin', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'g1',
        type: 'group',
        admin: 'admin1',
      });

      await expect(
        conversationsService.removeMember('g1', 'random-user', 'u2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should succeed when requester removes themself', async () => {
      const conversation = { id: 'g1', type: 'group', admin: 'admin1' };
      const updated = { id: 'g1', type: 'group', members: ['admin1'] };
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockConversationModel.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updated),
      });

      const result = await conversationsService.removeMember(
        'g1',
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toEqual(updated);
    });

    it('should succeed when admin removes another member', async () => {
      const conversation = { id: 'g1', type: 'group', admin: 'admin1' };
      const updated = { id: 'g1', type: 'group', members: ['admin1'] };
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockConversationModel.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updated),
      });

      const result = await conversationsService.removeMember(
        'g1',
        'admin1',
        '507f1f77bcf86cd799439012',
      );

      expect(result).toEqual(updated);
    });
  });

  describe('renameGroup', () => {
    it('should rename the group when requester is the admin', async () => {
      const conversation = { id: 'g1', type: 'group', admin: 'admin1' };
      const updated = { id: 'g1', type: 'group', name: 'New Name' };
      mockConversationModel.findById.mockResolvedValue(conversation);
      mockConversationModel.findByIdAndUpdate.mockReturnValue({
        populate: vi.fn().mockResolvedValue(updated),
      });

      const result = await conversationsService.renameGroup(
        'g1',
        'admin1',
        'New Name',
      );

      expect(result).toEqual(updated);
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'g1',
        { name: 'New Name' },
        { new: true },
      );
    });

    it('should throw ForbiddenException when requester is not the admin', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'g1',
        type: 'group',
        admin: 'admin1',
      });

      await expect(
        conversationsService.renameGroup('g1', 'not-admin', 'New Name'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      mockConversationModel.findById.mockResolvedValue(null);

      await expect(
        conversationsService.renameGroup('missing', 'admin1', 'New Name'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not a group conversation', async () => {
      mockConversationModel.findById.mockResolvedValue({
        id: 'c1',
        type: 'direct',
        admin: 'admin1',
      });

      await expect(
        conversationsService.renameGroup('c1', 'admin1', 'New Name'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
