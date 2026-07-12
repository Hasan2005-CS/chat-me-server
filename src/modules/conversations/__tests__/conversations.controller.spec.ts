import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationsController } from '../conversations.controller';

const mockConversationsService = {
  findOrCreateDirect: vi.fn(),
  createGroup: vi.fn(),
  findUserConversations: vi.fn(),
  addMembers: vi.fn(),
  removeMember: vi.fn(),
  renameGroup: vi.fn(),
};

describe('ConversationsController', () => {
  let conversationsController: ConversationsController;
  const req = { user: { id: '123' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    conversationsController = new ConversationsController(
      mockConversationsService as any,
    );
  });

  describe('createDirect', () => {
    it('should delegate to findOrCreateDirect', async () => {
      const mockResult = { id: 'c1' };
      mockConversationsService.findOrCreateDirect.mockResolvedValue(
        mockResult,
      );

      const result = await conversationsController.createDirect(req, {
        userId: 'u2',
      });

      expect(result).toEqual(mockResult);
      expect(
        mockConversationsService.findOrCreateDirect,
      ).toHaveBeenCalledWith('123', 'u2');
    });
  });

  describe('createGroup', () => {
    it('should delegate to createGroup', async () => {
      const mockResult = { id: 'g1' };
      mockConversationsService.createGroup.mockResolvedValue(mockResult);

      const result = await conversationsController.createGroup(req, {
        name: 'Team',
        memberIds: ['u2', 'u3'],
      });

      expect(result).toEqual(mockResult);
      expect(mockConversationsService.createGroup).toHaveBeenCalledWith(
        'Team',
        '123',
        ['u2', 'u3'],
      );
    });
  });

  describe('getMyConversations', () => {
    it('should delegate to findUserConversations', async () => {
      const mockResult = [{ id: 'c1' }];
      mockConversationsService.findUserConversations.mockResolvedValue(
        mockResult,
      );

      const result = await conversationsController.getMyConversations(req);

      expect(result).toEqual(mockResult);
      expect(
        mockConversationsService.findUserConversations,
      ).toHaveBeenCalledWith('123');
    });
  });

  describe('addMembers', () => {
    it('should delegate to addMembers', async () => {
      const mockResult = { id: 'g1', members: ['123', 'u2'] };
      mockConversationsService.addMembers.mockResolvedValue(mockResult);

      const result = await conversationsController.addMembers(req, 'g1', {
        memberIds: ['u2'],
      });

      expect(result).toEqual(mockResult);
      expect(mockConversationsService.addMembers).toHaveBeenCalledWith(
        'g1',
        '123',
        ['u2'],
      );
    });
  });

  describe('removeMember', () => {
    it('should delegate to removeMember', async () => {
      const mockResult = { id: 'g1', members: ['123'] };
      mockConversationsService.removeMember.mockResolvedValue(mockResult);

      const result = await conversationsController.removeMember(
        req,
        'g1',
        'u2',
      );

      expect(result).toEqual(mockResult);
      expect(mockConversationsService.removeMember).toHaveBeenCalledWith(
        'g1',
        '123',
        'u2',
      );
    });
  });

  describe('renameGroup', () => {
    it('should delegate to renameGroup', async () => {
      const mockResult = { id: 'g1', name: 'New Name' };
      mockConversationsService.renameGroup.mockResolvedValue(mockResult);

      const result = await conversationsController.renameGroup(req, 'g1', {
        name: 'New Name',
      });

      expect(result).toEqual(mockResult);
      expect(mockConversationsService.renameGroup).toHaveBeenCalledWith(
        'g1',
        '123',
        'New Name',
      );
    });
  });
});
