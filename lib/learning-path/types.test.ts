import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import {
  PathKnowledgeNodeSchema,
  PriorityFactorsInput,
  PathAdjustmentChangesSchema,
  WeeklyReportSummarySchema,
  WeeklyReportStaleItemSchema,
  WeeklyReportRecommendationsSchema,
  PathNodeStatusSchema,
  PathTypeSchema,
  AdjustmentTypeSchema,
  AdjustmentTriggerSchema,
  GeneratePathRequestSchema
} from './types';

describe('LearningPathTypes', () => {
  describe('PathNodeStatusSchema', () => {
    it('should validate valid statuses', () => {
      expect(PathNodeStatusSchema.safeParse('pending').success).toBe(true);
      expect(PathNodeStatusSchema.safeParse('learning').success).toBe(true);
      expect(PathNodeStatusSchema.safeParse('mastered').success).toBe(true);
      expect(PathNodeStatusSchema.safeParse('stale').success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = PathNodeStatusSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('PathKnowledgeNodeSchema', () => {
    it('should validate a valid knowledge node', () => {
      const input = {
        nodeId: 'kp123',
        priority: 8.5,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: ['权重高', '测评正确率低']
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const input = {
        nodeId: 'kp123',
        priority: 8.5,
        status: 'invalid',
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative priority', () => {
      const input = {
        nodeId: 'kp123',
        priority: -1,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept zero priority', () => {
      const input = {
        nodeId: 'kp123',
        priority: 0,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require nodeId', () => {
      const input = {
        priority: 8.5,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept empty reasons array', () => {
      const input = {
        nodeId: 'kp123',
        priority: 8.5,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('PathAdjustmentChangesSchema', () => {
    it('should validate adjustment changes with all fields', () => {
      const input = {
        added: ['kp1', 'kp2'],
        removed: ['kp3'],
        reordered: [{ nodeId: 'kp1', oldPriority: 5, newPriority: 8 }]
      };

      const result = PathAdjustmentChangesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with empty arrays', () => {
      const input = {
        added: [],
        removed: [],
        reordered: []
      };

      const result = PathAdjustmentChangesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate partial changes', () => {
      const input = {
        added: ['kp1'],
        removed: [],
        reordered: []
      };

      const result = PathAdjustmentChangesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require reordered item to have all fields', () => {
      const input = {
        added: [],
        removed: [],
        reordered: [{ nodeId: 'kp1' }] // missing oldPriority and newPriority
      };

      const result = PathAdjustmentChangesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('WeeklyReportSummarySchema', () => {
    it('should validate weekly summary with all fields', () => {
      const input = {
        practicedCount: 10,
        masteredCount: 3,
        weakCount: 2
      };

      const result = WeeklyReportSummarySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept zero values', () => {
      const input = {
        practicedCount: 0,
        masteredCount: 0,
        weakCount: 0
      };

      const result = WeeklyReportSummarySchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative counts', () => {
      const input = {
        practicedCount: -1,
        masteredCount: 0,
        weakCount: 0
      };

      const result = WeeklyReportSummarySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer counts', () => {
      const input = {
        practicedCount: 10.5,
        masteredCount: 0,
        weakCount: 0
      };

      const result = WeeklyReportSummarySchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('WeeklyReportStaleItemSchema', () => {
    it('should validate stale knowledge item', () => {
      const input = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        mastery: 0.85
      };

      const result = WeeklyReportStaleItemSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject mastery below 0', () => {
      const input = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date().toISOString(),
        mastery: -0.1
      };

      const result = WeeklyReportStaleItemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject mastery above 1', () => {
      const input = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date().toISOString(),
        mastery: 1.5
      };

      const result = WeeklyReportStaleItemSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept mastery of 0 and 1', () => {
      const input0 = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date().toISOString(),
        mastery: 0
      };

      const input1 = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date().toISOString(),
        mastery: 1
      };

      expect(WeeklyReportStaleItemSchema.safeParse(input0).success).toBe(true);
      expect(WeeklyReportStaleItemSchema.safeParse(input1).success).toBe(true);
    });
  });

  describe('WeeklyReportRecommendationsSchema', () => {
    it('should validate recommendations', () => {
      const input = {
        toReview: ['kp1', 'kp2'],
        toLearn: ['kp3', 'kp4', 'kp5']
      };

      const result = WeeklyReportRecommendationsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty arrays', () => {
      const input = {
        toReview: [],
        toLearn: []
      };

      const result = WeeklyReportRecommendationsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate partial recommendations', () => {
      const input1 = {
        toReview: ['kp1'],
        toLearn: []
      };

      const input2 = {
        toReview: [],
        toLearn: ['kp1']
      };

      expect(WeeklyReportRecommendationsSchema.safeParse(input1).success).toBe(true);
      expect(WeeklyReportRecommendationsSchema.safeParse(input2).success).toBe(true);
    });
  });

  describe('PathTypeSchema', () => {
    it('should validate all path types', () => {
      expect(PathTypeSchema.safeParse('initial').success).toBe(true);
      expect(PathTypeSchema.safeParse('weekly').success).toBe(true);
      expect(PathTypeSchema.safeParse('manual').success).toBe(true);
      expect(PathTypeSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('AdjustmentTypeSchema', () => {
    it('should validate all adjustment types', () => {
      expect(AdjustmentTypeSchema.safeParse('micro').success).toBe(true);
      expect(AdjustmentTypeSchema.safeParse('weekly').success).toBe(true);
      expect(AdjustmentTypeSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('AdjustmentTriggerSchema', () => {
    it('should validate all trigger types', () => {
      expect(AdjustmentTriggerSchema.safeParse('practice_completed').success).toBe(true);
      expect(AdjustmentTriggerSchema.safeParse('weekly_recalibration').success).toBe(true);
      expect(AdjustmentTriggerSchema.safeParse('manual').success).toBe(true);
      expect(AdjustmentTriggerSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('GeneratePathRequestSchema', () => {
    it('should validate request with assessmentId', () => {
      const input = {
        assessmentId: 'assessment-123'
      };

      const result = GeneratePathRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate request with userEdits', () => {
      const input = {
        assessmentId: 'assessment-123',
        userEdits: {
          add: ['kp1', 'kp2'],
          remove: ['kp3']
        }
      };

      const result = GeneratePathRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate request with only userEdits', () => {
      const input = {
        userEdits: {
          add: ['kp1'],
          remove: []
        }
      };

      const result = GeneratePathRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate empty request', () => {
      const input = {};

      const result = GeneratePathRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty arrays in userEdits', () => {
      const input = {
        userEdits: {
          add: [],
          remove: []
        }
      };

      const result = GeneratePathRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
