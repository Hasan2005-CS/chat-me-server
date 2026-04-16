import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ enum: ['direct', 'group'], required: true })
  type!: 'direct' | 'group';

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  members!: Types.ObjectId[];

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop({ default: Date.now })
  lastMessageAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Message' }) 
  lastMessage?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User' })
  admin?: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ members: 1, lastMessageAt: -1 });

ConversationSchema.index(
  {
    type: 1,
    members: 1,
  },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { type: 'direct' },
  },
);
