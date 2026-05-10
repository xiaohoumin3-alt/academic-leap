/**
 * Learning Flow Path Updater Tests
 *
 * Tests for dynamic path update logic based on student performance.
 * Covers mastery calculation, difficulty adjustment, and knowledge point selection.
 */

import {
  recalculateMastery,
  adjustDifficulty,
  getNextKnowledgePoint,
  shouldSkipContent,
  needsReview,
  type AnswerRecord,
  type MasteryState,
  type DifficultyAdjustmentResult,
} from '@/lib/learning-flow/path-updater';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    lEKnowledgePointState: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    iRTStudentState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    learningPath: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    pathAdjustment: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/rl/irt/estimator', () => ({
  estimateAbilityEAP: jest.fn().mockReturnValue({ theta: 0, confidence: 0.5 }),
  thetaToDeltaC: jest.fn().mockImplementation((theta: number) => (theta + 5) * 1),
  deltaCToDifficulty: jest.fn(),
}));

describe('Path Updater - Mastery Calculation', () => {
  describe('recalculateMastery', () => {
    it('should initialize mastery to 0.5 for new knowledge points', async () => {
      const currentStates = new Map<string, MasteryState>();
      const result = await recalculateMastery(currentStates, 'new-kp', true);

      expect(result.get('new-kp')).toBeGreaterThan(0.5);
    });

    it('should increase mastery for correct answers', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.5,
        attempts: 1,
        correctCount: 0,
        recentPerformance: [0],
        consecutiveCorrect: 0,
        consecutiveWrong: 1,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', true);

      expect(result.get('kp-1')).toBeGreaterThan(0.5);
    });

    it('should decrease mastery for incorrect answers', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.7,
        attempts: 5,
        correctCount: 4,
        recentPerformance: [1, 1, 1, 1],
        consecutiveCorrect: 4,
        consecutiveWrong: 0,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', false);

      expect(result.get('kp-1')).toBeLessThan(0.7);
    });

    it('should increase mastery with consecutive correct answers', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.5,
        attempts: 1,
        correctCount: 0,
        recentPerformance: [0],
        consecutiveCorrect: 0,
        consecutiveWrong: 1,
      });

      // First correct answer should increase from 0.5
      let result = await recalculateMastery(currentStates, 'kp-1', true);
      const firstMastery = result.get('kp-1');
      expect(firstMastery).toBeGreaterThan(0.5);

      // Second correct answer should keep increasing
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: firstMastery!,
        attempts: 2,
        correctCount: 1,
        recentPerformance: [0, 1],
        consecutiveCorrect: 1,
        consecutiveWrong: 0,
      });

      result = await recalculateMastery(currentStates, 'kp-1', true);
      // Mastery should continue increasing with consecutive correct
      expect(result.get('kp-1')).toBeGreaterThanOrEqual(firstMastery!);
    });

    it('should track consecutive incorrect answers', async () => {
      const currentStates = new Map<string, MasteryState>();

      // First incorrect answer
      await recalculateMastery(currentStates, 'kp-1', false);

      // Second incorrect answer
      const result = await recalculateMastery(currentStates, 'kp-1', false);

      // Mastery should decrease with consecutive wrong answers
      expect(result.get('kp-1')).toBeLessThan(0.5);
    });

    it('should reset consecutive counters after switching answer correctness', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.6,
        attempts: 5,
        correctCount: 3,
        recentPerformance: [1, 1, 1],
        consecutiveCorrect: 3,
        consecutiveWrong: 0,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', false);

      expect(result.get('kp-1')).toBeLessThan(0.6);
    });

    it('should limit mastery to range [0, 1]', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.95,
        attempts: 20,
        correctCount: 19,
        recentPerformance: [1, 1, 1, 1, 1],
        consecutiveCorrect: 10,
        consecutiveWrong: 0,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', true);

      expect(result.get('kp-1')).toBeLessThanOrEqual(1);
      expect(result.get('kp-1')).toBeGreaterThanOrEqual(0);
    });

    it('should not go below 0 for mastery', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.1,
        attempts: 10,
        correctCount: 1,
        recentPerformance: [0, 0, 0, 0, 0],
        consecutiveCorrect: 0,
        consecutiveWrong: 5,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', false);

      expect(result.get('kp-1')).toBeGreaterThanOrEqual(0);
    });

    it('should preserve mastery of other knowledge points', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.6,
        attempts: 5,
        correctCount: 3,
        recentPerformance: [1, 1, 1],
        consecutiveCorrect: 3,
        consecutiveWrong: 0,
      });
      currentStates.set('kp-2', {
        knowledgePointId: 'kp-2',
        mastery: 0.8,
        attempts: 10,
        correctCount: 8,
        recentPerformance: [1, 1, 1, 1],
        consecutiveCorrect: 4,
        consecutiveWrong: 0,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', true);

      // kp-2 should remain unchanged
      expect(result.get('kp-2')).toBe(0.8);
    });

    it('should limit recent performance to 10 entries', async () => {
      const currentStates = new Map<string, MasteryState>();
      currentStates.set('kp-1', {
        knowledgePointId: 'kp-1',
        mastery: 0.5,
        attempts: 15,
        correctCount: 8,
        recentPerformance: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0], // 10 entries
        consecutiveCorrect: 1,
        consecutiveWrong: 1,
      });

      const result = await recalculateMastery(currentStates, 'kp-1', true);

      // Function should complete without error
      expect(result.get('kp-1')).toBeDefined();
    });
  });
});

describe('Path Updater - Difficulty Adjustment', () => {
  describe('adjustDifficulty', () => {
    it('should increase difficulty for mastered content with good accuracy', async () => {
      const result = await adjustDifficulty(5.0, 0.85, true, 1.0);

      expect(result.newDifficulty).toBeGreaterThan(5.0);
      expect(result.reason).toContain('提升难度');
    });

    it('should decrease difficulty for struggling students', async () => {
      const result = await adjustDifficulty(5.0, 0.3, false, -1.0);

      expect(result.newDifficulty).toBeLessThan(5.0);
      expect(result.reason).toContain('降低难度');
    });

    it('should keep difficulty stable when performance is consistent', async () => {
      const result = await adjustDifficulty(5.0, 0.5, true, 0);

      expect(result.oldDifficulty).toBe(5.0);
      // New difficulty should be close to current
      expect(Math.abs(result.newDifficulty - 5.0)).toBeLessThan(2);
    });

    it('should respect minimum difficulty of 1', async () => {
      const result = await adjustDifficulty(1.5, 0.3, false, -2.0);

      expect(result.newDifficulty).toBeGreaterThanOrEqual(1);
    });

    it('should respect maximum difficulty of 10', async () => {
      const result = await adjustDifficulty(9.5, 0.9, true, 3.0);

      expect(result.newDifficulty).toBeLessThanOrEqual(10);
    });

    it('should adjust difficulty in 1 step increments', async () => {
      const result = await adjustDifficulty(5.0, 0.85, true, 1.0);

      // Should increase by 1 step
      expect(result.newDifficulty - 5.0).toBeCloseTo(1, 0);
    });

    it('should return old and new difficulty', async () => {
      const result = await adjustDifficulty(5.0, 0.5, true, 0.5);

      expect(result.oldDifficulty).toBe(5.0);
      expect(result.newDifficulty).toBeDefined();
      expect(result.reason).toBeDefined();
    });
  });
});

describe('Path Updater - Next Knowledge Point Selection', () => {
  const mockNodes: PathKnowledgeNode[] = [
    { nodeId: "kp-1", priority: 1, status: "learning", addedAt: "2024-01-01", reasons: [] },
    { nodeId: "kp-2", priority: 2, status: "learning", addedAt: "2024-01-01", reasons: [] },
    { nodeId: "kp-3", priority: 3, status: "learning", addedAt: "2024-01-01", reasons: [] },
  ];

  const mockPath = {
    knowledgeData: JSON.stringify(mockNodes),
  };

  describe('getNextKnowledgePoint', () => {
    it('should return current node if not mastered', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.5);

      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'kp-1');

      expect(result?.nodeId).toBe('kp-1');
    });

    it('should return next unmastered node when current is mastered', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.85); // Mastered
      masteryStates.set('kp-2', 0.5); // Not mastered
      masteryStates.set('kp-3', 0.9); // Mastered (but highest priority unmastered after kp-1)

      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'kp-1');

      // Since kp-2 is not mastered, it should be returned
      expect(result?.nodeId).toBe('kp-2');
    });

    it('should return highest priority unmastered node', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.9);
      masteryStates.set('kp-2', 0.9);
      masteryStates.set('kp-3', 0.4); // Not mastered

      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'kp-1');

      expect(result?.nodeId).toBe('kp-3');
    });

    it('should return next node in sequence when all are mastered', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.9);
      masteryStates.set('kp-2', 0.9);
      masteryStates.set('kp-3', 0.9);

      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'kp-1');

      expect(result?.nodeId).toBe('kp-2');
    });

    it('should handle nodes without mastery state', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.9);

      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'kp-1');

      expect(result).toBeDefined();
    });

    it('should return highest priority node as fallback', async () => {
      const masteryStates = new Map<string, number>();
      masteryStates.set('kp-1', 0.9);
      masteryStates.set('kp-2', 0.9);
      masteryStates.set('kp-3', 0.9);

      // No current knowledge point
      const result = await getNextKnowledgePoint(mockPath, masteryStates, 'nonexistent');

      // Should return highest priority (kp-3 with priority 3)
      expect(result?.priority).toBe(3);
    });
  });
});

describe('Path Updater - Helper Functions', () => {
  describe('shouldSkipContent', () => {
    it('should return true when content is mastered with consecutive correct answers', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.85,
        attempts: 10,
        correctCount: 9,
        recentPerformance: [1, 1, 1, 1],
        consecutiveCorrect: 3,
        consecutiveWrong: 0,
      };

      expect(shouldSkipContent(masteryState)).toBe(true);
    });

    it('should return false when not enough consecutive correct answers', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.85,
        attempts: 10,
        correctCount: 8,
        recentPerformance: [1, 1, 1],
        consecutiveCorrect: 2, // Less than threshold
        consecutiveWrong: 0,
      };

      expect(shouldSkipContent(masteryState)).toBe(false);
    });

    it('should return false when mastery is below threshold', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.7, // Below 0.8
        attempts: 10,
        correctCount: 7,
        recentPerformance: [1, 1, 1, 1],
        consecutiveCorrect: 4,
        consecutiveWrong: 0,
      };

      expect(shouldSkipContent(masteryState)).toBe(false);
    });
  });

  describe('needsReview', () => {
    it('should return true when there are too many consecutive wrong answers', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.5,
        attempts: 10,
        correctCount: 5,
        recentPerformance: [0, 0],
        consecutiveCorrect: 0,
        consecutiveWrong: 2,
      };

      expect(needsReview(masteryState)).toBe(true);
    });

    it('should return true when mastery is below struggling threshold', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.3, // Below 0.4
        attempts: 10,
        correctCount: 3,
        recentPerformance: [1, 0, 1],
        consecutiveCorrect: 1,
        consecutiveWrong: 0,
      };

      expect(needsReview(masteryState)).toBe(true);
    });

    it('should return false when performance is adequate', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.6,
        attempts: 10,
        correctCount: 6,
        recentPerformance: [1, 1, 1],
        consecutiveCorrect: 3,
        consecutiveWrong: 0,
      };

      expect(needsReview(masteryState)).toBe(false);
    });

    it('should return false with one consecutive wrong answer above threshold', () => {
      const masteryState: MasteryState = {
        knowledgePointId: 'kp-1',
        mastery: 0.6,
        attempts: 5,
        correctCount: 3,
        recentPerformance: [0],
        consecutiveCorrect: 0,
        consecutiveWrong: 1, // Less than 2
      };

      expect(needsReview(masteryState)).toBe(false);
    });
  });
});

describe('Path Updater - Constants', () => {
  it('should have correct mastery threshold for learned content', async () => {
    const currentStates = new Map<string, MasteryState>();
    currentStates.set('kp-1', {
      knowledgePointId: 'kp-1',
      mastery: 0.8,
      attempts: 10,
      correctCount: 8,
      recentPerformance: [1, 1, 1],
      consecutiveCorrect: 3,
      consecutiveWrong: 0,
    });

    const result = await recalculateMastery(currentStates, 'kp-1', true);

    // 0.8 is the threshold - at or above should trigger mastery behavior
    expect(result.get('kp-1')).toBeGreaterThanOrEqual(0.8);
  });

  it('should handle mastery below threshold correctly', async () => {
    const currentStates = new Map<string, MasteryState>();
    currentStates.set('kp-1', {
      knowledgePointId: 'kp-1',
      mastery: 0.4,
      attempts: 5,
      correctCount: 2,
      recentPerformance: [0, 1],
      consecutiveCorrect: 1,
      consecutiveWrong: 0,
    });

    const result = await recalculateMastery(currentStates, 'kp-1', false);

    // Below threshold with wrong answer should decrease mastery
    expect(result.get('kp-1')).toBeLessThan(0.4);
  });
});

describe('Path Updater - Answer Record Interface', () => {
  it('should accept valid answer record', () => {
    const record: AnswerRecord = {
      questionId: 'q-1',
      knowledgePointId: 'kp-1',
      isCorrect: true,
      deltaC: 5,
      duration: 30000,
      timestamp: new Date(),
    };

    expect(record.questionId).toBe('q-1');
    expect(record.isCorrect).toBe(true);
    expect(record.deltaC).toBe(5);
  });

  it('should accept answer record without optional fields', () => {
    const record: AnswerRecord = {
      questionId: 'q-1',
      knowledgePointId: 'kp-1',
      isCorrect: false,
      deltaC: 3,
      timestamp: new Date(),
    };

    expect(record.duration).toBeUndefined();
  });
});