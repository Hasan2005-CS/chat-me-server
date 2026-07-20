import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CallDocument = HydratedDocument<Call>;

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  MISSED = 'missed',
  ENDED = 'ended',
  BUSY = 'busy',
}

@Schema({ timestamps: true })
export class Call {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caller!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  callee!: Types.ObjectId;

  @Prop({ type: String, enum: CallType, required: true })
  type!: CallType;

  @Prop({ type: String, enum: CallStatus, default: CallStatus.RINGING })
  status!: CallStatus;

  @Prop({ default: Date.now })
  startedAt!: Date;

  @Prop()
  answeredAt?: Date;

  @Prop()
  endedAt?: Date;

  @Prop()
  endReason?: string;
}

export const CallSchema = SchemaFactory.createForClass(Call);

CallSchema.index({ conversation: 1, createdAt: -1 });
CallSchema.index({ caller: 1, status: 1 });
CallSchema.index({ callee: 1, status: 1 });
