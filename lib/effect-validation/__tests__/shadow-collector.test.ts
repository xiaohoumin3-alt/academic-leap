import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ShadowCollector } from '../shadow-collector';

jest.mock('@prisma/client');

describe('ShadowCollector', () => {
  let collector: ShadowCollector;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      shadowAttempt: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      canaryRelease: {
        upsert: jest.fn(),
      },
    };
    collector = new ShadowCollector(mockPrisma);
  });

  it('should record shadow attempt', async () => {
    mockPrisma.shadowAttempt.create.mockResolvedValueOnce({
      id: 'sa-1',
      templateId: 't-1',
      userId: 'u-1',
    });

    await collector.recordShadowAttempt({
      templateId: 't-1',
      userId: 'u-1',
      knowledgePoint: 'kp-1',
      isCorrect: true,
      duration: 30,
    });

    expect(mockPrisma.shadowAttempt.create).toHaveBeenCalled();
  });

  it('should check if ready for analysis', async () => {
    mockPrisma.shadowAttempt.count.mockResolvedValueOnce(50);

    const ready = await collector.isReadyForAnalysis('t-1');
    expect(ready).toBe(true);
  });

  it('should return false when insufficient samples', async () => {
    mockPrisma.shadowAttempt.count.mockResolvedValueOnce(30);

    const ready = await collector.isReadyForAnalysis('t-1');
    expect(ready).toBe(false);
  });

  it('should calculate accuracy', async () => {
    mockPrisma.shadowAttempt.findMany.mockResolvedValueOnce([
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false },
    ]);

    const result = await collector.calculateAccuracy('t-1');
    expect(result.accuracy).toBeCloseTo(0.667, 2);
    expect(result.sample).toBe(3);
  });
});
