import { Injectable } from '@nestjs/common';

@Injectable()
export class PresenceService {
  private onlineUsers = new Map<string, Set<string>>();

  addConnection(userId: string, socketId: string): boolean {
    const existing = this.onlineUsers.get(userId);
    if (!existing) {
      this.onlineUsers.set(userId, new Set([socketId]));
      return true;
    }
    existing.add(socketId);
    return false;
  }

  removeConnection(userId: string, socketId: string): boolean {
    const existing = this.onlineUsers.get(userId);
    if (!existing) return false;

    existing.delete(socketId);

    if (existing.size === 0) {
      this.onlineUsers.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.onlineUsers.get(userId) ?? []);
  }
}
