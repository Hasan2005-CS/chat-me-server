import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Call,
  CallDocument,
  CallStatus,
  CallType,
} from './schemas/call.schema';

@Injectable()
export class CallsService {
  constructor(
    @InjectModel(Call.name)
    private readonly callModel: Model<CallDocument>,
  ) {}

  async findActiveCallForUser(userId: string): Promise<CallDocument | null> {
    const userOid = new Types.ObjectId(userId);
    return this.callModel.findOne({
      $or: [{ caller: userOid }, { callee: userOid }],
      status: { $in: [CallStatus.RINGING, CallStatus.ACCEPTED] },
    });
  }

  async initiateCall(
    callerId: string,
    calleeId: string,
    conversationId: string,
    type: CallType,
  ): Promise<CallDocument> {
    return this.callModel.create({
      conversation: new Types.ObjectId(conversationId),
      caller: new Types.ObjectId(callerId),
      callee: new Types.ObjectId(calleeId),
      type,
      status: CallStatus.RINGING,
      startedAt: new Date(),
    });
  }

  async findById(callId: string): Promise<CallDocument | null> {
    return this.callModel.findById(callId);
  }

  private assertParticipant(call: CallDocument, userId: string): void {
    const isParticipant =
      String(call.caller) === userId || String(call.callee) === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this call.');
    }
  }

  otherParticipant(call: CallDocument, userId: string): string {
    return String(call.caller) === userId
      ? String(call.callee)
      : String(call.caller);
  }

  async accept(callId: string, userId: string): Promise<CallDocument> {
    const call = await this.callModel.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    this.assertParticipant(call, userId);
    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Call is no longer ringing.');
    }

    call.status = CallStatus.ACCEPTED;
    call.answeredAt = new Date();
    await call.save();
    return call;
  }

  async reject(callId: string, userId: string): Promise<CallDocument> {
    const call = await this.callModel.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    this.assertParticipant(call, userId);
    if (call.status !== CallStatus.RINGING) {
      throw new ConflictException('Call is no longer ringing.');
    }

    call.status = CallStatus.REJECTED;
    call.endedAt = new Date();
    call.endReason = 'rejected';
    await call.save();
    return call;
  }

  async end(
    callId: string,
    userId: string,
    reason: string = 'ended',
  ): Promise<CallDocument> {
    const call = await this.callModel.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    this.assertParticipant(call, userId);
    if (
      call.status !== CallStatus.RINGING &&
      call.status !== CallStatus.ACCEPTED
    ) {
      throw new ConflictException('Call has already ended.');
    }

    call.status = CallStatus.ENDED;
    call.endedAt = new Date();
    call.endReason = reason;
    await call.save();
    return call;
  }

  async markMissed(callId: string): Promise<CallDocument | null> {
    return this.callModel.findOneAndUpdate(
      { _id: new Types.ObjectId(callId), status: CallStatus.RINGING },
      { status: CallStatus.MISSED, endedAt: new Date(), endReason: 'timeout' },
      { new: true },
    );
  }

  async markUnavailable(callId: string): Promise<CallDocument | null> {
    return this.callModel.findOneAndUpdate(
      { _id: new Types.ObjectId(callId), status: CallStatus.RINGING },
      {
        status: CallStatus.MISSED,
        endedAt: new Date(),
        endReason: 'unavailable',
      },
      { new: true },
    );
  }

  async findHistory(
    userId: string,
    conversationId?: string,
    limit: number = 30,
  ): Promise<CallDocument[]> {
    const userOid = new Types.ObjectId(userId);
    const query: Record<string, unknown> = {
      $or: [{ caller: userOid }, { callee: userOid }],
    };
    if (conversationId) {
      query.conversation = new Types.ObjectId(conversationId);
    }

    return this.callModel
      .find(query)
      .populate('caller', 'displayName avatar')
      .populate('callee', 'displayName avatar')
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}
