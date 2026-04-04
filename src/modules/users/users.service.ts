import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findByProvider(
    provider: 'google' | 'github' | 'local',
    providerId: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({
      'identities.provider': provider,
      'identities.providerId': providerId,
    });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email });
  }
  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+passwordHash');
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  async updateLastSeen(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastSeenAt: new Date() });
  }
  async addIdentity(
    userId: string,
    identity: {
      provider: 'google' | 'github' | 'local';
      providerId: string;
      email: string;
      accessToken: string;
    },
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(userId, {
      $push: { identities: identity },
    });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
