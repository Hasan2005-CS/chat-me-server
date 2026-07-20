import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
  Ack,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConflictException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallsService } from './calls.service';
import { CallDocument, CallType } from './schemas/call.schema';
import { ConversationsService } from '../conversations/conversations.service';
import { UsersService } from '../users/users.service';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { WsJwtGuard } from '../messages/guards/ws-jwt.guard';

type CallInviteAck = (response: { callId?: string; error?: string }) => void;

interface AuthSocket extends Socket {
  user: { sub: string; email: string };
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'chat',
})
export class CallsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly ringTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly callsService: CallsService,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  private emitToUser(
    userId: string,
    event: string,
    payload: unknown,
    exceptSocketId?: string,
  ) {
    this.presenceService
      .getSocketIds(userId)
      .filter((socketId) => socketId !== exceptSocketId)
      .forEach((socketId) => {
        this.server.to(socketId).emit(event, payload);
      });
  }

  private clearRingTimeout(callId: string) {
    const timeout = this.ringTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.ringTimeouts.delete(callId);
    }
  }

  private async pushMissedCallNotification(
    calleeId: string,
    payload: {
      conversationId: string;
      callId: string;
      callerName: string;
      type: CallType;
    },
  ) {
    await this.notificationsService.notifyMissedCall(calleeId, payload);
    this.emitToUser(calleeId, 'notification', {
      type: NotificationType.MISSED_CALL,
      payload,
    });
  }

  async handleDisconnect(socket: AuthSocket) {
    const userId = socket.user?.sub;
    if (!userId) return;

    const remainingSockets = this.presenceService
      .getSocketIds(userId)
      .filter((id) => id !== socket.id);
    if (remainingSockets.length > 0) return;

    const activeCall = await this.callsService.findActiveCallForUser(userId);
    if (!activeCall) return;

    const callId = String(activeCall._id);
    this.clearRingTimeout(callId);
    await this.callsService.end(callId, userId, 'disconnected');

    const otherUserId = this.callsService.otherParticipant(activeCall, userId);
    this.emitToUser(otherUserId, 'call_ended', {
      callId,
      endedBy: userId,
      reason: 'disconnected',
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call_invite')
  async handleCallInvite(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { conversationId: string; type: 'audio' | 'video' },
    @Ack() ack: CallInviteAck,
  ) {
    const callerId = socket.user.sub;

    const conversation = await this.conversationsService.findById(
      body.conversationId,
    );
    if (!conversation || conversation.type !== 'direct') {
      ack({ error: 'Calls are only supported in direct conversations.' });
      return;
    }

    const calleeId = conversation.members
      .map((id) => String(id))
      .find((id) => id !== callerId);
    if (!calleeId) {
      ack({ error: 'Callee not found.' });
      return;
    }

    const isBlocked = await this.usersService.isBlockRelated(
      callerId,
      calleeId,
    );
    if (isBlocked) {
      ack({ error: 'Unable to call this user.' });
      return;
    }

    const [callerActiveCall, calleeActiveCall] = await Promise.all([
      this.callsService.findActiveCallForUser(callerId),
      this.callsService.findActiveCallForUser(calleeId),
    ]);
    if (callerActiveCall || calleeActiveCall) {
      ack({ error: 'busy' });
      socket.emit('call_busy', { conversationId: body.conversationId });
      return;
    }

    const type = body.type === 'video' ? CallType.VIDEO : CallType.AUDIO;
    const call = await this.callsService.initiateCall(
      callerId,
      calleeId,
      body.conversationId,
      type,
    );
    const callId = String(call._id);
    const caller = await this.usersService.findById(callerId);
    const callerName = caller?.displayName ?? socket.user.email;

    if (!this.presenceService.isOnline(calleeId)) {
      await this.callsService.markUnavailable(callId);
      // The caller still needs this callId to correctly match the
      // call_ended it's about to receive, even though no ringing UI
      // was ever shown.
      ack({ callId });
      socket.emit('call_ended', { callId, reason: 'unavailable' });
      await this.pushMissedCallNotification(calleeId, {
        conversationId: body.conversationId,
        callId,
        callerName,
        type,
      });
      return;
    }

    ack({ callId });

    this.emitToUser(calleeId, 'incoming_call', {
      callId,
      conversationId: body.conversationId,
      callerId,
      callerName,
      callerAvatar: caller?.avatar,
      type,
    });

    const ringTimeoutMs = this.configService.get<number>(
      'webrtc.callRingTimeoutMs',
      45000,
    );
    this.ringTimeouts.set(
      callId,
      setTimeout(() => {
        void this.handleRingTimeout(
          callId,
          callerId,
          calleeId,
          body,
          type,
          callerName,
        );
      }, ringTimeoutMs),
    );
  }

  private async handleRingTimeout(
    callId: string,
    callerId: string,
    calleeId: string,
    body: { conversationId: string },
    type: CallType,
    callerName: string,
  ) {
    this.ringTimeouts.delete(callId);
    const missed = await this.callsService.markMissed(callId);
    if (!missed) return;

    this.emitToUser(callerId, 'call_ended', { callId, reason: 'no_answer' });
    this.emitToUser(calleeId, 'call_ended', { callId, reason: 'no_answer' });
    await this.pushMissedCallNotification(calleeId, {
      conversationId: body.conversationId,
      callId,
      callerName,
      type,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call_offer')
  async handleCallOffer(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { callId: string; sdp: unknown },
  ) {
    const call = await this.callsService.findById(body.callId);
    if (!call) return;

    const otherUserId = this.callsService.otherParticipant(
      call,
      socket.user.sub,
    );
    this.emitToUser(otherUserId, 'call_offer', {
      callId: body.callId,
      sdp: body.sdp,
      from: socket.user.sub,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call_answer')
  async handleCallAnswer(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { callId: string; sdp: unknown },
  ) {
    let call: CallDocument;
    try {
      call = await this.callsService.accept(body.callId, socket.user.sub);
    } catch (err) {
      if (err instanceof ConflictException) {
        socket.emit('call_ended', {
          callId: body.callId,
          reason: 'no_longer_available',
        });
        return;
      }
      throw err;
    }
    this.clearRingTimeout(body.callId);

    const otherUserId = this.callsService.otherParticipant(
      call,
      socket.user.sub,
    );
    this.emitToUser(otherUserId, 'call_answer', {
      callId: body.callId,
      sdp: body.sdp,
      from: socket.user.sub,
    });
    this.emitToUser(
      socket.user.sub,
      'call_answered_elsewhere',
      { callId: body.callId },
      socket.id,
    );
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('ice_candidate')
  async handleIceCandidate(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { callId: string; candidate: unknown },
  ) {
    const call = await this.callsService.findById(body.callId);
    if (!call) return;

    const otherUserId = this.callsService.otherParticipant(
      call,
      socket.user.sub,
    );
    this.emitToUser(otherUserId, 'ice_candidate', {
      callId: body.callId,
      candidate: body.candidate,
      from: socket.user.sub,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call_reject')
  async handleCallReject(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { callId: string },
  ) {
    let call: CallDocument;
    try {
      call = await this.callsService.reject(body.callId, socket.user.sub);
    } catch (err) {
      if (err instanceof ConflictException) return;
      throw err;
    }
    this.clearRingTimeout(body.callId);

    const otherUserId = this.callsService.otherParticipant(
      call,
      socket.user.sub,
    );
    this.emitToUser(otherUserId, 'call_ended', {
      callId: body.callId,
      endedBy: socket.user.sub,
      reason: 'rejected',
    });
    this.emitToUser(
      socket.user.sub,
      'call_ended',
      { callId: body.callId, endedBy: socket.user.sub, reason: 'rejected' },
      socket.id,
    );
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('call_end')
  async handleCallEnd(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() body: { callId: string },
  ) {
    let call: CallDocument;
    try {
      call = await this.callsService.end(body.callId, socket.user.sub);
    } catch (err) {
      if (err instanceof ConflictException) return;
      throw err;
    }
    this.clearRingTimeout(body.callId);

    const otherUserId = this.callsService.otherParticipant(
      call,
      socket.user.sub,
    );
    this.emitToUser(otherUserId, 'call_ended', {
      callId: body.callId,
      endedBy: socket.user.sub,
      reason: 'ended',
    });
    this.emitToUser(
      socket.user.sub,
      'call_ended',
      { callId: body.callId, endedBy: socket.user.sub, reason: 'ended' },
      socket.id,
    );
  }
}
