import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LEAnalyzer } from '../le-analyzer';

jest.mock('@prisma/client');

describe('LEAnalyzer', () => {
  let analyzer: LEAnalyzer;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      rLTrainingLog: {
        groupBy: jest.fn(),
      },
      effectObservation: {
        groupBy: jest.fn(),
      },
    };
    analyzer = new LEAnalyzer(mockPrisma);
  });

  it('should calculate LE for knowledge point', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValueOnce([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.2 }, _count: 30 },
    ]);

    const result = await analyzer.calculateLE('kp-1');

    expect(result.knowledgePointId).toBe('kp-1');
    expect(result.le).toBe(0.2);
    expect(result.sampleSize).toBe(30);
  });

  it('should return low confidence for small sample', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValueOnce([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.2 }, _count: 10 },
    ]);

    const result = await analyzer.calculateLE('kp-1');

    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should detect LE drop anomaly', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValue([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.3 }, _count: 50 },
      { knowledgePointId: 'kp-2', _avg: { leDelta: 0.05 }, _count: 50 },
    ]);

    const anomalies = await analyzer.detectAnomalies();

    expect(anomalies.some((a: any) => a.type === 'le_drop')).toBe(true);
  });
});