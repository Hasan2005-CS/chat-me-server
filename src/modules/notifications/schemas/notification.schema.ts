import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  NEW_MESSAGE = 'new_message',
  GROUP_ADDED = 'group_added',
  GROUP_REMOVED = 'group_removed',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient!: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ default: false })
  isRead!: boolean;
}
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
