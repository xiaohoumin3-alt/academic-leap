import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExperimentManager } from '../experiment-manager';

jest.mock('@prisma/client');

describe('ExperimentManager', () => {
  let manager: ExperimentManager;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      effectExperiment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      effectAssignment: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      effectObservation: {
        create: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    manager = new ExperimentManager(mockPrisma);
  });

  it('should create experiment', async () => {
    mockPrisma.effectExperiment.create.mockResolvedValueOnce({
      id: 'exp-1',
      name: 'Test Experiment',
      status: 'draft',
    });

    const id = await manager.createExperiment({
      name: 'Test Experiment',
      controlTemplateId: 'ctrl-1',
      treatmentTemplateId: 'treat-1',
      targetMetric: 'accuracy',
      minSampleSize: 50,
    });

    expect(id).toBe('exp-1');
  });

  it('should assign variant deterministically', async () => {
    mockPrisma.effectAssignment.findUnique.mockResolvedValueOnce(null);
    mockPrisma.effectAssignment.create.mockResolvedValueOnce({});

    const v1 = await manager.assignVariant('user-1', 'exp-1');
    const v2 = await manager.assignVariant('user-1', 'exp-1');

    expect(v1).toBe(v2);
  });

  it('should analyze experiment with significant results', async () => {
    mockPrisma.effectExperiment.findUnique.mockResolvedValueOnce({
      id: 'exp-1',
      minSampleSize: 100,
    });
    // Larger sample sizes and effect to ensure significance
    mockPrisma.effectObservation.groupBy.mockResolvedValueOnce([
      { variant: 'control', _avg: { value: 0.5 }, _count: 200 },
      { variant: 'treatment', _avg: { value: 0.7 }, _count: 200 },
    ]);

    const result = await manager.analyzeExperiment('exp-1');

    expect(result.significant).toBe(true);
    expect(result.uplift).toBeGreaterThan(0);
  });
});
