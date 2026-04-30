// lib/qie/__tests__/rl-uok-integration.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { selectCandidate } from '../../rl/exploration/selector';
import { RLExplorationController } from '../../rl/exploration/rl-exploration-controller';
import type { ExplorationContext } from '../../rl/exploration/types';

describe('RL-UOK Integration', () => {
  describe('RLExplorationController integration', () => {
    let controller: RLExplorationController;

    beforeEach(() => {
      controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });
    });

    it('should return minimal candidates for healthy system', () => {
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 1,
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBe(2);
      expect(result.explorationLevel).toBe('minimal');
    });

    it('should increase candidates for consecutive same topic', () => {
      // Simulate consecutive same topic
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');

      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: controller.getConsecutiveSameTopicCount('algebra'),
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBeGreaterThanOrEqual(3);
      expect(result.factors.consecutiveSameTopic).toBeGreaterThanOrEqual(3);
    });

    it('should track topic history correctly', () => {
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('geometry');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');

      expect(controller.getConsecutiveSameTopicCount('algebra')).toBe(2);
      expect(controller.getConsecutiveSameTopicCount('geometry')).toBe(1);
    });
  });

  describe('Selector integration', () => {
    interface Candidate {
      id: string;
      complexity: number;
    }

    it('should select from candidates based on minimal exploration level', () => {
      const candidates: Candidate[] = [
        { id: 'q1', complexity: 0.5 },
        { id: 'q2', complexity: 0.6 },
        { id: 'q3', complexity: 0.7 },
        { id: 'q4', complexity: 0.8 },
        { id: 'q5', complexity: 0.9 },
      ];

      const results = Array(20).fill(null).map(() =>
        selectCandidate(candidates, 'minimal')
      );

      // Minimal should favor first candidates heavily
      const firstSelections = results.filter(r => r?.id === 'q1' || r?.id === 'q2').length;
      expect(firstSelections).toBeGreaterThan(10);
    });

    it('should distribute selections for aggressive exploration level', () => {
      const candidates: Candidate[] = [
        { id: 'q1', complexity: 0.5 },
        { id: 'q2', complexity: 0.6 },
        { id: 'q3', complexity: 0.7 },
        { id: 'q4', complexity: 0.8 },
        { id: 'q5', complexity: 0.9 },
      ];

      const results = Array(20).fill(null).map(() =>
        selectCandidate(candidates, 'aggressive')
      );

      // Aggressive should have more diverse selections
      const uniqueSelections = new Set(results.filter(Boolean).map(r => r!.id)).size;
      expect(uniqueSelections).toBeGreaterThan(2);
    });

    it('should handle empty candidates array', () => {
      const result = selectCandidate([], 'minimal');
      expect(result).toBeNull();
    });

    it('should return single candidate directly', () => {
      const candidates: Candidate[] = [{ id: 'q1', complexity: 0.5 }];
      const result = selectCandidate(candidates, 'minimal');
      expect(result?.id).toBe('q1');
    });
  });

  describe('End-to-end flow', () => {
    it('should track responses and adjust exploration', () => {
      const controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });

      // Record some responses
      controller.recordResponse({
        topic: 'algebra',
        correct: true,
        complexity: 0.6,
      });
      controller.recordResponse({
        topic: 'algebra',
        correct: false,
        complexity: 0.7,
      });

      // Get recommendation
      controller.recordRecommendation('algebra');

      const result = controller.getCandidateCount({
        topic: 'algebra',
        mastery: 0.5,
        consecutiveSameTopic: controller.getConsecutiveSameTopicCount('algebra'),
      });

      expect(result.candidateCount).toBeGreaterThanOrEqual(2);
      expect(result.factors).toBeDefined();
      expect(result.factors.le).toBeDefined();
      expect(result.factors.cs).toBeDefined();
    });

    it('should propagate health status from responses to exploration', () => {
      const controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });

      // Record multiple correct responses with varying complexity
      for (let i = 0; i < 10; i++) {
        controller.recordResponse({
          topic: 'algebra',
          correct: true,
          complexity: 0.3 + i * 0.07,
        });
      }

      const health = controller.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.metrics).toBeDefined();
    });

    it('should combine consecutive topic with health factors', () => {
      const controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });

      // Add responses first
      for (let i = 0; i < 5; i++) {
        controller.recordResponse({
          topic: 'algebra',
          correct: true,
          complexity: 0.6,
        });
      }

      // Then add consecutive same topic
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');

      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.7,
        consecutiveSameTopic: controller.getConsecutiveSameTopicCount('algebra'),
      };

      const result = controller.getCandidateCount(context);

      // Should have increased due to consecutive same topic
      expect(result.candidateCount).toBeGreaterThanOrEqual(3);
      expect(result.factors.consecutiveSameTopic).toBeGreaterThanOrEqual(4);
    });
  });

  describe('RL-UOK workflow simulation', () => {
    it('should simulate complete UOK recommendation flow', () => {
      // Initialize controller
      const controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });

      // Simulate user learning history
      const learningHistory = [
        { topic: 'algebra', correct: true, complexity: 0.5 },
        { topic: 'algebra', correct: true, complexity: 0.6 },
        { topic: 'geometry', correct: false, complexity: 0.7 },
        { topic: 'algebra', correct: true, complexity: 0.7 },
      ];

      // Record all responses
      for (const event of learningHistory) {
        controller.recordResponse(event);
      }

      // Get candidate count for next recommendation
      const candidateResult = controller.getCandidateCount({
        topic: 'algebra',
        mastery: 0.65,
        consecutiveSameTopic: 1,
      });

      // Simulate candidate generation (mock UOK output)
      const candidates = Array.from({ length: 5 }, (_, i) => ({
        id: `q${i + 1}`,
        complexity: 0.4 + i * 0.1,
      }));

      // Select candidate based on exploration level
      const selected = selectCandidate(candidates, candidateResult.explorationLevel);

      // Verify the selection happened
      expect(selected).toBeDefined();
      expect(selected?.id).toMatch(/^q[1-5]$/);

      // Record the recommendation
      controller.recordRecommendation('algebra');

      // Verify consecutive count updated
      const consecutiveCount = controller.getConsecutiveSameTopicCount('algebra');
      expect(consecutiveCount).toBeGreaterThanOrEqual(1);
    });

    it('should maintain exploration consistency across multiple iterations', () => {
      const controller = new RLExplorationController({
        baseCandidateCount: 2,
        maxCandidateCount: 5,
      });

      const explorationLevels: string[] = [];

      for (let i = 0; i < 5; i++) {
        const result = controller.getCandidateCount({
          topic: `topic_${i % 3}`,
          mastery: 0.5 + Math.random() * 0.4,
          consecutiveSameTopic: 1,
        });

        explorationLevels.push(result.explorationLevel);

        // Record some responses
        controller.recordResponse({
          topic: `topic_${i % 3}`,
          correct: Math.random() > 0.3,
          complexity: 0.5 + Math.random() * 0.3,
        });
      }

      // All exploration levels should be valid
      expect(explorationLevels.every(level =>
        ['minimal', 'moderate', 'aggressive'].includes(level)
      )).toBe(true);
    });
  });
});
