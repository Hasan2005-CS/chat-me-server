import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallsController } from '../calls.controller';

const mockCallsService = {
  findHistory: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

describe('CallsController', () => {
  let callsController: CallsController;
  const req = { user: { id: '123' } } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    callsController = new CallsController(
      mockCallsService as any,
      mockConfigService as any,
    );
  });

  describe('getHistory', () => {
    it('should delegate to findHistory with the requester id', async () => {
      const mockResult = [{ id: 'call1' }];
      mockCallsService.findHistory.mockResolvedValue(mockResult);

      const result = await callsController.getHistory(req, 'c1', '10');

      expect(result).toEqual(mockResult);
      expect(mockCallsService.findHistory).toHaveBeenCalledWith(
        '123',
        'c1',
        10,
      );
    });
  });

  describe('getIceServers', () => {
    it('should always include a public STUN server', () => {
      mockConfigService.get.mockImplementation(
        (key: string, fallback: unknown) => fallback,
      );

      const result = callsController.getIceServers();

      expect(result.iceServers).toEqual([
        { urls: 'stun:stun.l.google.com:19302' },
      ]);
    });

    it('should include a TURN server when configured', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'webrtc.turnUrls') return ['turn:example.com:3478'];
        if (key === 'webrtc.turnUsername') return 'user';
        if (key === 'webrtc.turnCredential') return 'secret';
        return undefined;
      });

      const result = callsController.getIceServers();

      expect(result.iceServers).toEqual([
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: ['turn:example.com:3478'],
          username: 'user',
          credential: 'secret',
        },
      ]);
    });
  });
});
