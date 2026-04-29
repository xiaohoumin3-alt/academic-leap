// lib/rl/validation/validation.test.ts

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateDFI } from './dfi';
import { validateLE } from './le';
import { prisma } from '../../prisma';

describe('Validation Functions', () => {
  beforeEach(async () => {
    await prisma.rLModelVersion.deleteMany({});
    await prisma.rLTrainingLog.deleteMany({});
  });

  afterEach(async () => {
    await prisma.rLModelVersion.deleteMany({});
    await prisma.rLTrainingLog.deleteMany({});
  });

  describe('validateDFI', () => {
    it('should pass with complete tracking', async () => {
      const model = await prisma.rLModelVersion.create({
        data: {
          version: 'v1',
          algorithm: 'ThompsonSampling',
          status: 'TRAINING'
        }
      });

      await prisma.rLTrainingLog.create({
        data: {
          modelId: model.id,
          eventId: 'event1',
          attemptId: 'attempt1',
          userId: 'user1',
          questionId: 'q1',
          knowledgePointId: 'kp1',
          recommendationId: 'rec1',
          preAccuracy: 0.5,
          stateTheta: 0,
          selectedDeltaC: 5,
          reward: 0.7
        }
      });

      const result = await validateDFI(prisma);
      expect(result.dfi).toBe(1);
      expect(result.pass).toBe(true);
    });

    it('should fail with empty eventId', async () => {
      const model = await prisma.rLModelVersion.create({
        data: {
          version: 'v1',
          algorithm: 'ThompsonSampling',
          status: 'TRAINING'
        }
      });

      await prisma.rLTrainingLog.create({
        data: {
          modelId: model.id,
          eventId: '', // Empty!
          attemptId: 'attempt1',
          userId: 'user1',
          questionId: 'q1',
          knowledgePointId: 'kp1',
          recommendationId: 'rec1',
          preAccuracy: 0.5,
          stateTheta: 0,
          selectedDeltaC: 5,
          reward: 0.7
        }
      });

      const result = await validateDFI(prisma);
      expect(result.dfi).toBeLessThan(1);
      expect(result.pass).toBe(false);
      expect(result.gaps).toContain('1 logs have empty eventId');
    });
  });

  describe('validateLE', () => {
    it('should pass with positive LE', async () => {
      const model = await prisma.rLModelVersion.create({
        data: {
          version: 'v1',
          algorithm: 'ThompsonSampling',
          status: 'TRAINING'
        }
      });

      await prisma.rLTrainingLog.createMany({
        data: [
          {
            modelId: model.id,
            eventId: 'e1',
            attemptId: 'a1',
            userId: 'user1',
            questionId: 'q1',
            knowledgePointId: 'kp1',
            recommendationId: 'rec1',
            preAccuracy: 0.5,
            postAccuracy: 0.7,
            leDelta: 0.2,
            stateTheta: 0,
            selectedDeltaC: 5,
            reward: 0.7
          },
          {
            modelId: model.id,
            eventId: 'e2',
            attemptId: 'a2',
            userId: 'user1',
            questionId: 'q2',
            knowledgePointId: 'kp1',
            recommendationId: 'rec2',
            preAccuracy: 0.7,
            postAccuracy: 0.8,
            leDelta: 0.1,
            stateTheta: 0.1,
            selectedDeltaC: 5.5,
            reward: 0.6
          }
        ]
      });

      const result = await validateLE(prisma);
      expect(result.le).toBe(0.15); // (0.2 + 0.1) / 2
      expect(result.pass).toBe(true); // Exactly at threshold
    });

    it('should fail with negative LE', async () => {
      const model = await prisma.rLModelVersion.create({
        data: {
          version: 'v1',
          algorithm: 'ThompsonSampling',
          status: 'TRAINING'
        }
      });

      await prisma.rLTrainingLog.create({
        data: {
          modelId: model.id,
          eventId: 'e1',
          attemptId: 'a1',
          userId: 'user1',
          questionId: 'q1',
          knowledgePointId: 'kp1',
          recommendationId: 'rec1',
          preAccuracy: 0.8,
          postAccuracy: 0.6,
          leDelta: -0.2,
          stateTheta: 0,
          selectedDeltaC: 5,
          reward: 0.3
        }
      });

      const result = await validateLE(prisma);
      expect(result.le).toBe(-0.2);
      expect(result.pass).toBe(false);
    });
  });
});
