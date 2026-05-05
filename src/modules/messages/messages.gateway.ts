import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from './messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { MessageStatus } from './schemas/message.schema';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
interface AuthSocket extends Socket {
  user: { sub: string; email: string };
}

interface JwtPayload {
  sub: string;
  email: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private onlineUsers = new Map<string, string>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private extractToken(socket: AuthSocket): string | null {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const authToken = auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = socket.handshake.headers?.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice('Bearer '.length);
    }

    return null;
  }

  async handleConnection(socket: AuthSocket) {
    try {
      const token = this.extractToken(socket);

      if (!token) {
        socket.disconnect();
        return;
      }

      const secret = this.configService.getOrThrow<string>('jwt.secret');
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      socket.user = payload;

      this.onlineUsers.set(payload.sub, socket.id);

      const conversations =
        await this.conversationsService.findUserConversations(payload.sub);

      for (const conversation of conversations) {
        await socket.join(conversation.id);
      }

      // Mark all pending messages as DELIVERED and notify conversation rooms
      const conversationIds = conversations.map((c) => String(c.id));
      const deliveredMap = await this.messagesService.markDelivered(
        payload.sub,
        conversationIds,
      );
      for (const [convId, messageIds] of deliveredMap) {
        this.server.to(convId).emit('messages_delivered', {
          messageIds,
          conversationId: convId,
          recipientIds: [payload.sub],
        });
      }

      console.log(`User ${payload.sub} connected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Token verification failed: ${message}`);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthSocket) {
    const userId = socket.user?.sub;
    if (userId) {
      this.onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody()
    body: {
      conversationId: string;
      content: string;
      type?: 'text' | 'image' | 'audio' | 'video';
      replyTo?: string;
    },
  ) {
    const senderId = socket.user.sub;

    const isMember = await this.conversationsService.isMember(
      body.conversationId,
      senderId,
    );
    if (!isMember) {
      socket.emit('error', {
        message: 'You are not allowed to send messages in this conversation.',
      });
      return;
    }

    const message = await this.messagesService.create({
      conversationId: body.conversationId,
      senderId,
      content: body.content,
      type: body.type!,
      replyTo: body.replyTo,
    });

    await this.conversationsService.updateLastMessage(
      body.conversationId,
      message.id,
    );

    this.server.to(body.conversationId).emit('new_message', message);

    const conversation = await this.conversationsService.findById(
      body.conversationId,
    );

    if (conversation) {
      const memberIds = conversation.members.map((id) => String(id));
      const offlineMembers = memberIds.filter(
        (id) => id !== senderId && !this.isUserOnline(id),
      );
      const onlineRecipients = memberIds.filter(
        (id) => id !== senderId && this.isUserOnline(id),
      );

      // Auto-mark DELIVERED for all online recipients
      if (onlineRecipients.length > 0) {
        await Promise.all(
          onlineRecipients.map((id) =>
            this.messagesService.updateStatus(
              message.id,
              id,
              MessageStatus.DELIVERED,
            ),
          ),
        );
        this.server.to(body.conversationId).emit('messages_delivered', {
          messageIds: [message.id],
          conversationId: body.conversationId,
          recipientIds: onlineRecipients,
        });
      }

      if (offlineMembers.length > 0) {
        await this.notificationsService.notifyNewMessage(
          offlineMembers,
          senderId,
          {
            conversationId: body.conversationId,
            senderName: socket.user.email,
            preview:
              body.type === 'text'
                ? body.content.slice(0, 100)
                : `Sent a ${body.type} message`,
          },
        );
      }
      onlineRecipients.forEach((memberId) => {
        const memberSocketId = this.onlineUsers.get(memberId);
        if (memberSocketId) {
          this.server.to(memberSocketId).emit('notification', {
            type: NotificationType.NEW_MESSAGE,
            payload: {
              conversationId: body.conversationId,
              senderName: socket.user.email,
              preview:
                body.type === 'text'
                  ? body.content.slice(0, 100)
                  : `Sent a ${body.type} message`,
            },
          });
        }
      });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    const isMember = await this.conversationsService.isMember(
      body.conversationId,
      socket.user.sub,
    );

    if (!isMember) {
      socket.emit('error', {
        message: 'You are not allowed to join this conversation.',
      });
      return;
    }

    await socket.join(body.conversationId);
    socket.emit('joined', { conversationId: body.conversationId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { messageId: string; conversationId: string },
  ) {
    const isMember = await this.conversationsService.isMember(
      body.conversationId,
      socket.user.sub,
    );
    if (!isMember) {
      socket.emit('error', { message: 'Not authorized.' });
      return;
    }

    await this.messagesService.updateStatus(
      body.messageId,
      socket.user.sub,
      MessageStatus.READ,
    );

    this.server.to(body.conversationId).emit('message_read', {
      messageId: body.messageId,
      conversationId: body.conversationId,
      readBy: socket.user.sub,
    });
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
