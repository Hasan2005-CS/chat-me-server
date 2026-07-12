import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { MessagesService } from '../messages.service';
import { MessageStatus } from '../schemas/message.schema';

const mockMessageModel = {
  find: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
};

describe('MessagesService', () => {
  let messagesService: MessagesService;

  beforeEach(() => {
    vi.clearAllMocks();
    messagesService = new MessagesService(mockMessageModel as any);
  });

  describe('create', () => {
    it('should default type to "text" when not provided', async () => {
      const conversationId = new Types.ObjectId().toString();
      const senderId = new Types.ObjectId().toString();
      mockMessageModel.create.mockResolvedValue({ id: 'm1' });

      await messagesService.create({
        conversationId,
        senderId,
        content: 'hello',
      } as any);

      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text' }),
      );
    });

    it('should call messageModel.create with mapped ObjectIds and receipts', async () => {
      const conversationId = new Types.ObjectId().toString();
      const senderId = new Types.ObjectId().toString();
      const mockMessage = { id: 'm1' };
      mockMessageModel.create.mockResolvedValue(mockMessage);

      const result = await messagesService.create({
        conversationId,
        senderId,
        content: 'hello',
        type: 'text',
      });

      expect(result).toEqual(mockMessage);
      expect(mockMessageModel.create).toHaveBeenCalledWith({
        conversation: expect.any(Types.ObjectId),
        sender: expect.any(Types.ObjectId),
        content: 'hello',
        type: 'text',
        replyTo: undefined,
        receipts: [
          {
            user: expect.any(Types.ObjectId),
            status: MessageStatus.SENT,
          },
        ],
      });

      const callArg = mockMessageModel.create.mock.calls[0][0];
      expect(callArg.conversation.toString()).toBe(conversationId);
      expect(callArg.sender.toString()).toBe(senderId);
      expect(callArg.receipts[0].user.toString()).toBe(senderId);
      expect(callArg.receipts[0].status).toBe(MessageStatus.SENT);
    });

    it('should map replyTo to an ObjectId when provided', async () => {
      const conversationId = new Types.ObjectId().toString();
      const senderId = new Types.ObjectId().toString();
      const replyTo = new Types.ObjectId().toString();
      mockMessageModel.create.mockResolvedValue({ id: 'm1' });

      await messagesService.create({
        conversationId,
        senderId,
        content: 'hi',
        type: 'text',
        replyTo,
      });

      const callArg = mockMessageModel.create.mock.calls[0][0];
      expect(callArg.replyTo.toString()).toBe(replyTo);
    });
  });

  describe('findByConversation', () => {
    it('should query without _id filter when before is not provided', async () => {
      const mockMessages = [{ id: 'm1' }];
      const limitFn = vi.fn().mockResolvedValue(mockMessages);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      const populate2Fn = vi.fn().mockReturnValue({ sort: sortFn });
      const populate1Fn = vi.fn().mockReturnValue({ populate: populate2Fn });
      mockMessageModel.find.mockReturnValue({ populate: populate1Fn });

      const conversationId = new Types.ObjectId().toString();
      const result = await messagesService.findByConversation(conversationId);

      expect(result).toEqual(mockMessages);
      const query = mockMessageModel.find.mock.calls[0][0];
      expect(query._id).toBeUndefined();
      expect(query.conversation.toString()).toBe(conversationId);
      expect(query.isDeleted).toBe(false);
    });

    it('should query with _id $lt filter when before is provided', async () => {
      const mockMessages = [{ id: 'm2' }];
      const limitFn = vi.fn().mockResolvedValue(mockMessages);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      const populate2Fn = vi.fn().mockReturnValue({ sort: sortFn });
      const populate1Fn = vi.fn().mockReturnValue({ populate: populate2Fn });
      mockMessageModel.find.mockReturnValue({ populate: populate1Fn });

      const conversationId = new Types.ObjectId().toString();
      const before = new Types.ObjectId().toString();
      const result = await messagesService.findByConversation(
        conversationId,
        30,
        before,
      );

      expect(result).toEqual(mockMessages);
      const query = mockMessageModel.find.mock.calls[0][0];
      expect(query._id).toBeDefined();
      expect((query._id as any).$lt.toString()).toBe(before);
    });
  });

  describe('updateStatus', () => {
    it('should not call findByIdAndUpdate when findOneAndUpdate resolves a doc', async () => {
      mockMessageModel.findOneAndUpdate.mockResolvedValue({ id: 'm1' });

      const messageId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      await messagesService.updateStatus(messageId, userId, MessageStatus.READ);

      expect(mockMessageModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockMessageModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should call findByIdAndUpdate to push a new receipt when findOneAndUpdate resolves null', async () => {
      mockMessageModel.findOneAndUpdate.mockResolvedValue(null);
      mockMessageModel.findByIdAndUpdate.mockResolvedValue({ id: 'm1' });

      const messageId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      await messagesService.updateStatus(
        messageId,
        userId,
        MessageStatus.DELIVERED,
      );

      expect(mockMessageModel.findByIdAndUpdate).toHaveBeenCalledWith(
        messageId,
        {
          $push: {
            receipts: {
              user: expect.any(Types.ObjectId),
              status: MessageStatus.DELIVERED,
            },
          },
        },
      );
    });
  });

  describe('markDelivered', () => {
    it('should return an empty Map immediately when conversationIds is empty', async () => {
      const userId = new Types.ObjectId().toString();
      const result = await messagesService.markDelivered(userId, []);

      expect(result).toEqual(new Map());
      expect(mockMessageModel.find).not.toHaveBeenCalled();
      expect(mockMessageModel.updateMany).not.toHaveBeenCalled();
    });

    it('should return an empty Map and not call updateMany when find resolves empty array', async () => {
      mockMessageModel.find.mockResolvedValue([]);
      const userId = new Types.ObjectId().toString();
      const conversationId = new Types.ObjectId().toString();

      const result = await messagesService.markDelivered(userId, [
        conversationId,
      ]);

      expect(result).toEqual(new Map());
      expect(mockMessageModel.updateMany).not.toHaveBeenCalled();
    });

    it('should call updateMany and return a Map keyed by conversation id', async () => {
      const userId = new Types.ObjectId().toString();
      const conv1 = new Types.ObjectId();
      const conv2 = new Types.ObjectId();
      const msg1Id = new Types.ObjectId();
      const msg2Id = new Types.ObjectId();
      const msg3Id = new Types.ObjectId();

      const mockMessages = [
        { _id: msg1Id, conversation: conv1 },
        { _id: msg2Id, conversation: conv1 },
        { _id: msg3Id, conversation: conv2 },
      ];
      mockMessageModel.find.mockResolvedValue(mockMessages);
      mockMessageModel.updateMany.mockResolvedValue({});

      const result = await messagesService.markDelivered(userId, [
        conv1.toString(),
        conv2.toString(),
      ]);

      expect(mockMessageModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [msg1Id, msg2Id, msg3Id] } },
        {
          $push: {
            receipts: {
              user: expect.any(Types.ObjectId),
              status: MessageStatus.DELIVERED,
            },
          },
        },
      );

      expect(result.get(conv1.toString())).toEqual([
        msg1Id.toString(),
        msg2Id.toString(),
      ]);
      expect(result.get(conv2.toString())).toEqual([msg3Id.toString()]);
    });
  });

  describe('softDelete', () => {
    it('should return true when findOneAndUpdate resolves truthy', async () => {
      mockMessageModel.findOneAndUpdate.mockResolvedValue({ id: 'm1' });

      const result = await messagesService.softDelete(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      );

      expect(result).toBe(true);
    });

    it('should return false when findOneAndUpdate resolves null', async () => {
      mockMessageModel.findOneAndUpdate.mockResolvedValue(null);

      const result = await messagesService.softDelete(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      );

      expect(result).toBe(false);
    });
  });
});
