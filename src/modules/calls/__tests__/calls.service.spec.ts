import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CallsService } from '../calls.service';
import { CallStatus, CallType } from '../schemas/call.schema';

const mockCallModel = {
  create: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  findOneAndUpdate: vi.fn(),
  find: vi.fn(),
};

describe('CallsService', () => {
  let callsService: CallsService;

  beforeEach(() => {
    vi.clearAllMocks();
    callsService = new CallsService(mockCallModel as any);
  });

  describe('initiateCall', () => {
    it('should create a call with ringing status', async () => {
      const callerId = new Types.ObjectId().toString();
      const calleeId = new Types.ObjectId().toString();
      const conversationId = new Types.ObjectId().toString();
      mockCallModel.create.mockResolvedValue({ id: 'c1' });

      await callsService.initiateCall(
        callerId,
        calleeId,
        conversationId,
        CallType.AUDIO,
      );

      expect(mockCallModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CallType.AUDIO,
          status: CallStatus.RINGING,
        }),
      );
    });
  });

  describe('accept', () => {
    it('should throw NotFoundException when call does not exist', async () => {
      mockCallModel.findById.mockResolvedValue(null);
      await expect(callsService.accept('missing', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      const call = {
        caller: new Types.ObjectId(),
        callee: new Types.ObjectId(),
        save: vi.fn(),
      };
      mockCallModel.findById.mockResolvedValue(call);

      await expect(
        callsService.accept('c1', new Types.ObjectId().toString()),
      ).rejects.toThrow(ForbiddenException);
      expect(call.save).not.toHaveBeenCalled();
    });

    it('should set status to accepted and persist for a participant', async () => {
      const calleeId = new Types.ObjectId().toString();
      const call = {
        caller: new Types.ObjectId(),
        callee: new Types.ObjectId(calleeId),
        status: CallStatus.RINGING,
        save: vi.fn(),
      };
      mockCallModel.findById.mockResolvedValue(call);

      const result = await callsService.accept('c1', calleeId);

      expect(result.status).toBe(CallStatus.ACCEPTED);
      expect(result.answeredAt).toBeInstanceOf(Date);
      expect(call.save).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should set status to rejected for a participant', async () => {
      const calleeId = new Types.ObjectId().toString();
      const call = {
        caller: new Types.ObjectId(),
        callee: new Types.ObjectId(calleeId),
        save: vi.fn(),
      };
      mockCallModel.findById.mockResolvedValue(call);

      const result = await callsService.reject('c1', calleeId);

      expect(result.status).toBe(CallStatus.REJECTED);
      expect(result.endReason).toBe('rejected');
    });
  });

  describe('end', () => {
    it('should set status to ended with the given reason', async () => {
      const callerId = new Types.ObjectId().toString();
      const call = {
        caller: new Types.ObjectId(callerId),
        callee: new Types.ObjectId(),
        save: vi.fn(),
      };
      mockCallModel.findById.mockResolvedValue(call);

      const result = await callsService.end('c1', callerId, 'disconnected');

      expect(result.status).toBe(CallStatus.ENDED);
      expect(result.endReason).toBe('disconnected');
    });
  });

  describe('otherParticipant', () => {
    it('should return the callee id when queried from the caller', () => {
      const callerId = new Types.ObjectId().toString();
      const calleeId = new Types.ObjectId().toString();
      const call = {
        caller: new Types.ObjectId(callerId),
        callee: new Types.ObjectId(calleeId),
      } as any;

      expect(callsService.otherParticipant(call, callerId)).toBe(calleeId);
      expect(callsService.otherParticipant(call, calleeId)).toBe(callerId);
    });
  });

  describe('findActiveCallForUser', () => {
    it('should query for ringing or accepted calls involving the user', async () => {
      mockCallModel.findOne.mockResolvedValue(null);
      const userId = new Types.ObjectId().toString();

      await callsService.findActiveCallForUser(userId);

      expect(mockCallModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          status: { $in: [CallStatus.RINGING, CallStatus.ACCEPTED] },
        }),
      );
    });
  });
});
