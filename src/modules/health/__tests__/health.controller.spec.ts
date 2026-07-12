import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from '../health.controller';

const mockHealthCheckService = {
  check: vi.fn(),
};

const mockMongooseHealthIndicator = {
  pingCheck: vi.fn(),
};

const mockMemoryHealthIndicator = {
  checkHeap: vi.fn(),
};

const mockDiskHealthIndicator = {};

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(() => {
    vi.clearAllMocks();
    healthController = new HealthController(
      mockHealthCheckService as any,
      mockMongooseHealthIndicator as any,
      mockMemoryHealthIndicator as any,
      mockDiskHealthIndicator as any,
    );
  });

  describe('check', () => {
    it('should invoke mongoose and memory health checks and return result', () => {
      const mockResult = { status: 'ok' };
      mockHealthCheckService.check.mockImplementation((checks: any[]) => {
        checks.forEach((fn) => fn());
        return mockResult;
      });
      mockMongooseHealthIndicator.pingCheck.mockResolvedValue({
        mongodb: { status: 'up' },
      });
      mockMemoryHealthIndicator.checkHeap.mockResolvedValue({
        memory_heap: { status: 'up' },
      });

      const result = healthController.check();

      expect(result).toEqual(mockResult);
      expect(mockMongooseHealthIndicator.pingCheck).toHaveBeenCalledWith(
        'mongodb',
      );
      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        300 * 1024 * 1024,
      );
    });
  });
});
