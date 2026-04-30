import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CanaryController } from '../canary-controller';

jest.mock('@prisma/client');

describe('CanaryController', () => {
  let controller: CanaryController;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      canaryRelease: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      canaryStageHistory: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    controller = new CanaryController(mockPrisma);
  });

  it('should start canary with 5% traffic', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'pending',
      currentStage: 0,
      trafficPercent: 0,
    });

    await controller.startCanary('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: 't-1' },
        data: expect.objectContaining({
          status: 'running',
          currentStage: 0,
          trafficPercent: 5,
        }),
      })
    );
  });

  it('should increase traffic to next stage', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'running',
      currentStage: 0,
      trafficPercent: 5,
    });

    await controller.increaseTraffic('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: 't-1' },
        data: expect.objectContaining({
          currentStage: 1,
          trafficPercent: 10,
        }),
      })
    );
  });

  it('should complete canary at final stage', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'running',
      currentStage: 4,
      trafficPercent: 50,
    });

    await controller.increaseTraffic('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: 't-1' },
        data: expect.objectContaining({
          status: 'completed',
          trafficPercent: 100,
        }),
      })
    );
  });
});
