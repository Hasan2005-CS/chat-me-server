import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class Identity {
  @Prop({ required: true, enum: ['google', 'github', 'local'] })
  provider!: 'google' | 'github' | 'local';

  @Prop({ required: true })
  providerId!: string;

  @Prop()
  email?: string;

  @Prop({ select: false })
  accessToken?: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  displayName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop()
  avatar?: string;

  @Prop({ maxlength: 160 })
  bio?: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ type: [Identity], default: [] })
  identities!: Identity[];

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role!: 'user' | 'admin';

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: Date.now })
  lastSeenAt!: Date;

  @Prop({ select: false })
  refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { 'identities.provider': 1, 'identities.providerId': 1 },
  { unique: true, sparse: true },
);
UserSchema.index({ email: 1 });
UserSchema.index({ displayName: 'text', email: 'text' });
