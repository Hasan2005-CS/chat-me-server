import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { MessagesController } from '../messages.controller';

const mockMessagesService = {
  findByConversation: vi.fn(),
  search: vi.fn(),
};

const mockConversationsService = {
  isMember: vi.fn(),
};

describe('MessagesController', () => {
  let messagesController: MessagesController;
  const req = { user: { id: '123' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    messagesController = new MessagesController(
      mockMessagesService as any,
      mockConversationsService as any,
    );
  });

  describe('getMessages', () => {
    it('should delegate to findByConversation when the requester is a member', async () => {
      const mockResult = [{ id: 'm1' }];
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.findByConversation.mockResolvedValue(mockResult);

      const result = await messagesController.getMessages(req, 'c1', '10');

      expect(result).toEqual(mockResult);
      expect(mockConversationsService.isMember).toHaveBeenCalledWith(
        'c1',
        '123',
      );
      expect(mockMessagesService.findByConversation).toHaveBeenCalledWith(
        'c1',
        10,
        undefined,
      );
    });

    it('should throw ForbiddenException when the requester is not a member', async () => {
      mockConversationsService.isMember.mockResolvedValue(false);

      await expect(messagesController.getMessages(req, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockMessagesService.findByConversation).not.toHaveBeenCalled();
    });
  });

  describe('searchMessages', () => {
    it('should delegate to search when the requester is a member', async () => {
      const mockResult = [{ id: 'm1', content: 'hello world' }];
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.search.mockResolvedValue(mockResult);

      const result = await messagesController.searchMessages(
        req,
        'c1',
        'hello',
      );

      expect(result).toEqual(mockResult);
      expect(mockMessagesService.search).toHaveBeenCalledWith('c1', 'hello');
    });

    it('should throw ForbiddenException when the requester is not a member', async () => {
      mockConversationsService.isMember.mockResolvedValue(false);

      await expect(
        messagesController.searchMessages(req, 'c1', 'hello'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockMessagesService.search).not.toHaveBeenCalled();
    });
  });
});
