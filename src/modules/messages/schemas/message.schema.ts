import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  FILE = 'file',
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender!: Types.ObjectId;

  @Prop({
    type: String,
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type!: MessageType;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: 'User' },
        status: {
          type: String,
          enum: MessageStatus,
          default: MessageStatus.SENT,
        },
      },
    ],
    default: [],
    _id: false,
  })
  receipts!: {
    user: Types.ObjectId;
    status: MessageStatus;
  }[];

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ default: false })
  isEdited!: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({
    type: [
      {
        user: { type: Types.ObjectId, ref: 'User' },
        emoji: { type: String },
      },
    ],
    default: [],
    _id: false,
  })
  reactions!: {
    user: Types.ObjectId;
    emoji: string;
  }[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversation: 1, createdAt: -1 });
