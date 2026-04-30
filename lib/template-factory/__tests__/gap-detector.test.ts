import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GapDetector } from '../gap-detector';

jest.mock('@prisma/client');

describe('GapDetector', () => {
  let detector: GapDetector;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      knowledgePoint: {
        findMany: jest.fn(),
      },
      template: {
        groupBy: jest.fn(),
      },
      knowledgeCoverage: {
        upsert: jest.fn(),
      },
    };
    detector = new GapDetector(mockPrisma);
  });

  it('should detect knowledge gaps', async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValueOnce([
      { id: 'kp-1', name: 'Linear Equations', weight: 10 },
      { id: 'kp-2', name: 'Quadratic Equations', weight: 5 },
    ]);

    mockPrisma.template.groupBy.mockResolvedValueOnce([
      { knowledgeId: 'kp-1', _count: 2 },
    ]);

    const gaps = await detector.detectGaps();

    // Sorted by priority first (high before medium), then by gap descending
    expect(gaps).toHaveLength(2);
    // kp-2 has high priority (full gap = 3, weight 5)
    expect(gaps[0].gap).toBe(3);
    expect(gaps[0].priority).toBe('high');
    // kp-1 has medium priority (gap = 1, weight > 5)
    expect(gaps[1].gap).toBe(1);
    expect(gaps[1].priority).toBe('medium');
  });

  it('should return empty when no gaps', async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValueOnce([
      { id: 'kp-1', name: 'Complete', weight: 5 },
    ]);

    mockPrisma.template.groupBy.mockResolvedValueOnce([
      { knowledgeId: 'kp-1', _count: 5 },
    ]);

    const gaps = await detector.detectGaps();

    expect(gaps).toHaveLength(0);
  });
});
