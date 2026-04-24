import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateMicroAdjustments,
  applyMicroAdjustments,
  type PracticeResult,
  type MicroAdjustment,
} from './adapter';
import type { PathKnowledgeNode } from './types';

describe('Learning Path Adapter - Micro Adjustments', () => {
  // Use PathKnowledgeNode format
  const mockNodes: PathKnowledgeNode[] = [
    {
      nodeId: 'kp-1',
      priority: 0.8,
      status: 'pending',
      addedAt: new Date().toISOString(),
      reasons: []
    },
    {
      nodeId: 'kp-2',
      priority: 0.6,
      status: 'pending',
      addedAt: new Date().toISOString(),
      reasons: []
    },
    {
      nodeId: 'kp-3',
      priority: 0.4,
      status: 'pending',
      addedAt: new Date().toISOString(),
      reasons: []
    }
  ];

  describe('calculateMicroAdjustments', () => {
    it('should decrease priority by 20% for correct answers', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-1', isCorrect: true }
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      // Should include kp-1 (direct adjustment)
      const kp1Adjustment = result.adjustments.find(a => a.nodeId === 'kp-1');
      expect(kp1Adjustment).toBeDefined();
      expect(kp1Adjustment?.newPriority).toBeCloseTo(0.64, 5); // 0.8 * (1 - 0.2)
      expect(kp1Adjustment?.reason).toContain('正确');
    });

    it('should increase priority by 30% for wrong answers', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-2', isCorrect: false }
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      const kp2Adjustment = result.adjustments.find(a => a.nodeId === 'kp-2');
      expect(kp2Adjustment).toBeDefined();
      expect(kp2Adjustment?.newPriority).toBeCloseTo(0.78, 5); // 0.6 * (1 + 0.3)
      expect(kp2Adjustment?.reason).toContain('错误');
    });

    it('should handle multiple practice results', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-1', isCorrect: true },
        { knowledgePointId: 'kp-2', isCorrect: false }
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      // Should include both direct adjustments
      expect(result.adjustments.length).toBeGreaterThanOrEqual(2);

      const kp1Adjustment = result.adjustments.find(a => a.nodeId === 'kp-1');
      const kp2Adjustment = result.adjustments.find(a => a.nodeId === 'kp-2');

      expect(kp1Adjustment?.newPriority).toBeCloseTo(0.64, 5);
      expect(kp2Adjustment?.newPriority).toBeCloseTo(0.78, 5);
    });

    it('should recommend next highest priority node', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-1', isCorrect: false } // Will increase to 1.04
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      expect(result.nextRecommendation).toBeDefined();
      expect(result.nextRecommendation?.nodeId).toBe('kp-1');
    });

    it('should clamp priority to non-negative', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-1', isCorrect: false } // 0.8 * 1.3 = 1.04 → clamped
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      const kp1Adjustment = result.adjustments.find(a => a.nodeId === 'kp-1');
      expect(kp1Adjustment?.newPriority).toBeLessThanOrEqual(1.0);
      expect(kp1Adjustment?.newPriority).toBeGreaterThanOrEqual(0);
    });

    it('should skip unknown knowledge point IDs', () => {
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'unknown-kp', isCorrect: true }
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      // No adjustments for unknown nodes
      const unknownAdjustment = result.adjustments.find(a => a.nodeId === 'unknown-kp');
      expect(unknownAdjustment).toBeUndefined();
    });

    it('should calculate correct next recommendation after adjustments', () => {
      // When kp-1 is mastered (decreased), kp-2 should be next
      const practiceResults: PracticeResult[] = [
        { knowledgePointId: 'kp-1', isCorrect: true }
      ];

      const result = calculateMicroAdjustments(mockNodes, practiceResults);

      // kp-2 should have highest priority after kp-1 decreases
      expect(result.nextRecommendation?.nodeId).toBe('kp-2');
    });
  });
});
