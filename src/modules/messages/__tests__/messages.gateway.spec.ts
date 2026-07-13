import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessagesGateway } from '../messages.gateway';
import { MessageStatus } from '../schemas/message.schema';
import { NotificationType } from '../../notifications/schemas/notification.schema';

const mockMessagesService = {
  create: vi.fn(),
  markDelivered: vi.fn(),
  updateStatus: vi.fn(),
  editMessage: vi.fn(),
  softDelete: vi.fn(),
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
};

const mockConversationsService = {
  findUserConversations: vi.fn(),
  isMember: vi.fn(),
  findById: vi.fn(),
  updateLastMessage: vi.fn(),
};

const mockJwtService = {
  verify: vi.fn(),
};

const mockConfigService = {
  getOrThrow: vi.fn(),
};

const mockNotificationsService = {
  notifyNewMessage: vi.fn(),
};

function createSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sock1',
    handshake: { auth: {}, headers: {} },
    disconnect: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
    user: undefined,
    ...overrides,
  } as any;
}

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('secret');
    gateway = new MessagesGateway(
      mockMessagesService as any,
      mockConversationsService as any,
      mockJwtService as any,
      mockConfigService as any,
      mockNotificationsService as any,
    );
    gateway.server = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as any;
  });

  describe('handleConnection', () => {
    it('disconnects when no token is provided', async () => {
      const socket = createSocket();

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });

    it('authenticates, joins conversations, and emits delivered messages', async () => {
      const socket = createSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'user1',
        email: 'user1@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([
        { id: 'c1' },
      ]);
      mockMessagesService.markDelivered.mockResolvedValue(
        new Map([['c1', ['m1']]]),
      );

      await gateway.handleConnection(socket);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.user).toEqual({ sub: 'user1', email: 'user1@test.com' });
      expect(
        mockConversationsService.findUserConversations,
      ).toHaveBeenCalledWith('user1');
      expect(socket.join).toHaveBeenCalledWith('c1');
      expect(mockMessagesService.markDelivered).toHaveBeenCalledWith('user1', [
        'c1',
      ]);
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith('messages_delivered', {
        messageIds: ['m1'],
        conversationId: 'c1',
        recipientIds: ['user1'],
      });
      expect(gateway.isUserOnline('user1')).toBe(true);
    });

    it('disconnects when token verification throws', async () => {
      const socket = createSocket({
        handshake: { auth: { token: 'bad-token' }, headers: {} },
      });
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when a non-Error value is thrown during verification', async () => {
      const socket = createSocket({
        handshake: { auth: { token: 'bad-token' }, headers: {} },
      });
      mockJwtService.verify.mockImplementation(() => {
        throw 'not-an-error-instance';
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('extracts token from authorization header when auth.token absent', async () => {
      const socket = createSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'user2',
        email: 'user2@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([]);
      mockMessagesService.markDelivered.mockResolvedValue(new Map());

      await gateway.handleConnection(socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('header-token', {
        secret: 'secret',
      });
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes the user from online users when socket.user is set', async () => {
      const socket = createSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'user1',
        email: 'user1@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([]);
      mockMessagesService.markDelivered.mockResolvedValue(new Map());

      await gateway.handleConnection(socket);
      expect(gateway.isUserOnline('user1')).toBe(true);

      gateway.handleDisconnect(socket);

      expect(gateway.isUserOnline('user1')).toBe(false);
    });

    it('does nothing and does not throw when socket.user is not set', () => {
      const socket = createSocket();

      expect(() => gateway.handleDisconnect(socket)).not.toThrow();
    });
  });

  describe('handleSendMessage', () => {
    it('emits error and does not create a message when sender is not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleSendMessage(socket, {
        conversationId: 'c1',
        content: 'hi',
        type: 'text',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'You are not allowed to send messages in this conversation.',
      });
      expect(mockMessagesService.create).not.toHaveBeenCalled();
    });

    it('creates message, notifies online recipient, and emits delivered + notification (text type)', async () => {
      // Bring user2 online first
      const onlineSocket = createSocket({
        id: 'sock2',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'user2',
        email: 'user2@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([]);
      mockMessagesService.markDelivered.mockResolvedValue(new Map());
      await gateway.handleConnection(onlineSocket);
      expect(gateway.isUserOnline('user2')).toBe(true);

      const senderSocket = createSocket({
        user: { sub: 'user1', email: 'user1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.create.mockResolvedValue({ id: 'm1' });
      mockConversationsService.updateLastMessage.mockResolvedValue(undefined);
      mockConversationsService.findById.mockResolvedValue({
        id: 'c1',
        members: ['user1', 'user2', 'user3'],
      });
      mockMessagesService.updateStatus.mockResolvedValue(undefined);
      mockNotificationsService.notifyNewMessage.mockResolvedValue(undefined);

      await gateway.handleSendMessage(senderSocket, {
        conversationId: 'c1',
        content: 'hello world',
        type: 'text',
      });

      expect(mockMessagesService.create).toHaveBeenCalledWith({
        conversationId: 'c1',
        senderId: 'user1',
        content: 'hello world',
        type: 'text',
        replyTo: undefined,
      });
      expect(mockConversationsService.updateLastMessage).toHaveBeenCalledWith(
        'c1',
        'm1',
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith('new_message', {
        id: 'm1',
      });

      // online recipient (user2) gets delivered status update
      expect(mockMessagesService.updateStatus).toHaveBeenCalledWith(
        'm1',
        'user2',
        MessageStatus.DELIVERED,
      );
      expect(gateway.server.emit).toHaveBeenCalledWith('messages_delivered', {
        messageIds: ['m1'],
        conversationId: 'c1',
        recipientIds: ['user2'],
      });

      // offline recipient (user3) gets a notification
      expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
        ['user3'],
        'user1',
        {
          conversationId: 'c1',
          senderName: 'user1@test.com',
          preview: 'hello world',
        },
      );

      // online recipient (user2) gets a direct notification emit via their socket id
      expect(gateway.server.to).toHaveBeenCalledWith('sock2');
      expect(gateway.server.emit).toHaveBeenCalledWith('notification', {
        type: NotificationType.NEW_MESSAGE,
        payload: {
          conversationId: 'c1',
          senderName: 'user1@test.com',
          preview: 'hello world',
        },
      });
    });

    it('uses a generic preview for non-text message types', async () => {
      const senderSocket = createSocket({
        user: { sub: 'user1', email: 'user1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.create.mockResolvedValue({ id: 'm2' });
      mockConversationsService.updateLastMessage.mockResolvedValue(undefined);
      mockConversationsService.findById.mockResolvedValue({
        id: 'c1',
        members: ['user1', 'user3'],
      });
      mockNotificationsService.notifyNewMessage.mockResolvedValue(undefined);

      await gateway.handleSendMessage(senderSocket, {
        conversationId: 'c1',
        content: 'http://image.png',
        type: 'image',
      });

      expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
        ['user3'],
        'user1',
        {
          conversationId: 'c1',
          senderName: 'user1@test.com',
          preview: 'Sent a image message',
        },
      );
    });

    it('does not notify anyone when every other member is online', async () => {
      const onlineSocket = createSocket({
        id: 'sock3',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'user2',
        email: 'user2@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([]);
      mockMessagesService.markDelivered.mockResolvedValue(new Map());
      await gateway.handleConnection(onlineSocket);

      const senderSocket = createSocket({
        user: { sub: 'user1', email: 'user1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.create.mockResolvedValue({ id: 'm4' });
      mockConversationsService.updateLastMessage.mockResolvedValue(undefined);
      mockConversationsService.findById.mockResolvedValue({
        id: 'c1',
        members: ['user1', 'user2'],
      });
      mockMessagesService.updateStatus.mockResolvedValue(undefined);

      await gateway.handleSendMessage(senderSocket, {
        conversationId: 'c1',
        content: 'hi',
        type: 'text',
      });

      expect(mockNotificationsService.notifyNewMessage).not.toHaveBeenCalled();
    });

    it('does nothing further when conversation lookup returns null', async () => {
      const senderSocket = createSocket({
        user: { sub: 'user1', email: 'user1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.create.mockResolvedValue({ id: 'm3' });
      mockConversationsService.updateLastMessage.mockResolvedValue(undefined);
      mockConversationsService.findById.mockResolvedValue(null);

      await gateway.handleSendMessage(senderSocket, {
        conversationId: 'c1',
        content: 'hi',
        type: 'text',
      });

      expect(mockNotificationsService.notifyNewMessage).not.toHaveBeenCalled();
      expect(mockMessagesService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('emits error when socket is not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleJoinConversation(socket, { conversationId: 'c1' });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'You are not allowed to join this conversation.',
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins the room and emits joined when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);

      await gateway.handleJoinConversation(socket, { conversationId: 'c1' });

      expect(socket.join).toHaveBeenCalledWith('c1');
      expect(socket.emit).toHaveBeenCalledWith('joined', {
        conversationId: 'c1',
      });
    });
  });

  describe('handleMarkRead', () => {
    it('emits error when not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleMarkRead(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Not authorized.',
      });
      expect(mockMessagesService.updateStatus).not.toHaveBeenCalled();
    });

    it('updates status and emits message_read when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.updateStatus.mockResolvedValue(undefined);

      await gateway.handleMarkRead(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(mockMessagesService.updateStatus).toHaveBeenCalledWith(
        'm1',
        'user1',
        MessageStatus.READ,
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith('message_read', {
        messageId: 'm1',
        conversationId: 'c1',
        readBy: 'user1',
      });
    });
  });

  describe('handleTyping', () => {
    it('does nothing when not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleTyping(socket, { conversationId: 'c1' });

      expect(socket.to).not.toHaveBeenCalled();
    });

    it('broadcasts user_typing to the room when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);

      await gateway.handleTyping(socket, { conversationId: 'c1' });

      expect(socket.to).toHaveBeenCalledWith('c1');
      expect(socket.emit).toHaveBeenCalledWith('user_typing', {
        conversationId: 'c1',
        userId: 'user1',
      });
    });
  });

  describe('handleStopTyping', () => {
    it('broadcasts user_stopped_typing to the room when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);

      await gateway.handleStopTyping(socket, { conversationId: 'c1' });

      expect(socket.to).toHaveBeenCalledWith('c1');
      expect(socket.emit).toHaveBeenCalledWith('user_stopped_typing', {
        conversationId: 'c1',
        userId: 'user1',
      });
    });
  });

  describe('handleEditMessage', () => {
    it('emits error when editMessage resolves null', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockMessagesService.editMessage.mockResolvedValue(null);

      await gateway.handleEditMessage(socket, {
        messageId: 'm1',
        conversationId: 'c1',
        content: 'edited',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'You are not allowed to edit this message.',
      });
      expect(gateway.server.emit).not.toHaveBeenCalled();
    });

    it('broadcasts message_edited when the edit succeeds', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      const editedAt = new Date();
      mockMessagesService.editMessage.mockResolvedValue({
        content: 'edited',
        editedAt,
      });

      await gateway.handleEditMessage(socket, {
        messageId: 'm1',
        conversationId: 'c1',
        content: 'edited',
      });

      expect(mockMessagesService.editMessage).toHaveBeenCalledWith(
        'm1',
        'user1',
        'edited',
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith('message_edited', {
        messageId: 'm1',
        conversationId: 'c1',
        content: 'edited',
        editedAt,
      });
    });
  });

  describe('handleDeleteMessage', () => {
    it('emits error when softDelete resolves false', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockMessagesService.softDelete.mockResolvedValue(false);

      await gateway.handleDeleteMessage(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'You are not allowed to delete this message.',
      });
      expect(gateway.server.emit).not.toHaveBeenCalled();
    });

    it('broadcasts message_deleted when the delete succeeds', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockMessagesService.softDelete.mockResolvedValue(true);

      await gateway.handleDeleteMessage(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(mockMessagesService.softDelete).toHaveBeenCalledWith(
        'm1',
        'user1',
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith('message_deleted', {
        messageId: 'm1',
        conversationId: 'c1',
      });
    });
  });

  describe('handleAddReaction', () => {
    it('emits error when not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleAddReaction(socket, {
        messageId: 'm1',
        conversationId: 'c1',
        emoji: '👍',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Not authorized.',
      });
      expect(mockMessagesService.addReaction).not.toHaveBeenCalled();
    });

    it('adds the reaction and broadcasts message_reaction_added when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.addReaction.mockResolvedValue({ id: 'm1' });

      await gateway.handleAddReaction(socket, {
        messageId: 'm1',
        conversationId: 'c1',
        emoji: '👍',
      });

      expect(mockMessagesService.addReaction).toHaveBeenCalledWith(
        'm1',
        'user1',
        '👍',
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'message_reaction_added',
        {
          messageId: 'm1',
          conversationId: 'c1',
          userId: 'user1',
          emoji: '👍',
        },
      );
    });
  });

  describe('handleRemoveReaction', () => {
    it('emits error when not a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(false);

      await gateway.handleRemoveReaction(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Not authorized.',
      });
      expect(mockMessagesService.removeReaction).not.toHaveBeenCalled();
    });

    it('removes the reaction and broadcasts message_reaction_removed when a member', async () => {
      const socket = createSocket({
        user: { sub: 'user1', email: 'u1@test.com' },
      });
      mockConversationsService.isMember.mockResolvedValue(true);
      mockMessagesService.removeReaction.mockResolvedValue({ id: 'm1' });

      await gateway.handleRemoveReaction(socket, {
        messageId: 'm1',
        conversationId: 'c1',
      });

      expect(mockMessagesService.removeReaction).toHaveBeenCalledWith(
        'm1',
        'user1',
      );
      expect(gateway.server.to).toHaveBeenCalledWith('c1');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'message_reaction_removed',
        {
          messageId: 'm1',
          conversationId: 'c1',
          userId: 'user1',
        },
      );
    });
  });

  describe('isUserOnline', () => {
    it('returns true after a successful connection for that user', async () => {
      const socket = createSocket({
        handshake: { auth: { token: 'valid-token' }, headers: {} },
      });
      mockJwtService.verify.mockReturnValue({
        sub: 'userX',
        email: 'x@test.com',
      });
      mockConversationsService.findUserConversations.mockResolvedValue([]);
      mockMessagesService.markDelivered.mockResolvedValue(new Map());

      await gateway.handleConnection(socket);

      expect(gateway.isUserOnline('userX')).toBe(true);
    });

    it('returns false for an unknown user', () => {
      expect(gateway.isUserOnline('unknown-user')).toBe(false);
    });
  });
});
