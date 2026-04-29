// lib/rl/reward/le-reward.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryLEHistoryService } from '../history/le-history-service';
import { calculateLEReward, calculateHybridReward } from './le-reward';
import type { StudentResponse, LETrackingContext } from './le-reward';

describe('calculateLEReward', () => {
  let historyService: InMemoryLEHistoryService;

  beforeEach(() => {
    historyService = new InMemoryLEHistoryService();
  });

  it('should give reward > 0.5 for improvement', async () => {
    const response: StudentResponse = {
      userId: 'user1',
      questionId: 'q1',
      correct: true,
      knowledgePointId: 'kp1',
      eventId: 'e1',
      attemptId: 'a1'
    };

    const context: LETrackingContext = {
      knowledgePointId: 'kp1',
      preAccuracy: 0.5,
      recommendationId: 'r1'
    };

    const result = await calculateLEReward(response, context, historyService);

    expect(result.reward).toBeGreaterThan(0.5);
    expect(result.leDelta).toBeGreaterThan(0);
  });

  it('should give reward < 0.5 for decline', async () => {
    // Pre-seed with high accuracy
    historyService.updateAccuracy('user1', 'kp1', true);
    historyService.updateAccuracy('user1', 'kp1', true);
    historyService.updateAccuracy('user1', 'kp1', true);

    const preAccuracy = historyService.getAccuracy('user1', 'kp1');

    const response: StudentResponse = {
      userId: 'user1',
      questionId: 'q1',
      correct: false,
      knowledgePointId: 'kp1',
      eventId: 'e1',
      attemptId: 'a1'
    };

    const context: LETrackingContext = {
      knowledgePointId: 'kp1',
      preAccuracy,
      recommendationId: 'r1'
    };

    const result = await calculateLEReward(response, context, historyService);

    expect(result.reward).toBeLessThan(0.5);
    expect(result.leDelta).toBeLessThan(0);
  });

  it('should give reward < 0.5 for decline from high accuracy', async () => {
    // Start with 1 correct (100% accuracy)
    historyService.updateAccuracy('user1', 'kp1', true);
    const preAccuracy = historyService.getAccuracy('user1', 'kp1');
    expect(preAccuracy).toBe(1);

    const response: StudentResponse = {
      userId: 'user1',
      questionId: 'q1',
      correct: false,
      knowledgePointId: 'kp1',
      eventId: 'e1',
      attemptId: 'a1'
    };

    const context: LETrackingContext = {
      knowledgePointId: 'kp1',
      preAccuracy,
      recommendationId: 'r1'
    };

    const result = await calculateLEReward(response, context, historyService);

    // Going from 1.0 to 0.5 is a decline, so reward < 0.5
    expect(result.reward).toBeLessThan(0.5);
    expect(result.leDelta).toBe(-0.5);
  });
});

describe('calculateHybridReward', () => {
  let historyService: InMemoryLEHistoryService;

  beforeEach(() => {
    historyService = new InMemoryLEHistoryService();
  });

  it('should combine accuracy and LE rewards', async () => {
    const response: StudentResponse = {
      userId: 'user1',
      questionId: 'q1',
      correct: true,
      knowledgePointId: 'kp1',
      eventId: 'e1',
      attemptId: 'a1'
    };

    const context: LETrackingContext = {
      knowledgePointId: 'kp1',
      preAccuracy: 0.5,
      recommendationId: 'r1'
    };

    const result = await calculateHybridReward(response, context, historyService);

    expect(result.reward).toBeGreaterThan(0);
    expect(result.reward).toBeLessThanOrEqual(1);
  });

  it('should weight LE more heavily with higher leWeight', async () => {
    const response: StudentResponse = {
      userId: 'user1',
      questionId: 'q1',
      correct: true,
      knowledgePointId: 'kp1',
      eventId: 'e1',
      attemptId: 'a1'
    };

    const context: LETrackingContext = {
      knowledgePointId: 'kp1',
      preAccuracy: 0.5,
      recommendationId: 'r1'
    };

    const resultLow = await calculateHybridReward(response, context, historyService, 0.3);

    const newHistory = new InMemoryLEHistoryService();
    const resultHigh = await calculateHybridReward(response, { ...context, preAccuracy: 0.5 }, newHistory, 0.7);

    expect(resultLow.reward).not.toBe(resultHigh.reward);
  });
});
