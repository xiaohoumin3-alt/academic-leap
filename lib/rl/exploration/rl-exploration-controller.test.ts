// lib/rl/exploration/rl-exploration-controller.test.ts
import { RLExplorationController } from './rl-exploration-controller';
import type { ExplorationConfig, ExplorationContext } from './types';

describe('RLExplorationController', () => {
  const defaultConfig: ExplorationConfig = {
    baseCandidateCount: 2,
    maxCandidateCount: 5,
    explorationThreshold: 0.3,
  };

  describe('getCandidateCount', () => {
    it('should return base count for fresh controller', () => {
      const controller = new RLExplorationController(defaultConfig);
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 1,
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBe(2);
      expect(result.explorationLevel).toBe('minimal');
      expect(result.reason).toContain('healthy');
    });

    it('should increase count for consecutive same topic >= 3', () => {
      const controller = new RLExplorationController(defaultConfig);
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 3,
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBeGreaterThanOrEqual(3);
      expect(result.factors.consecutiveSameTopic).toBe(3);
    });

    it('should cap at maxCandidateCount', () => {
      const controller = new RLExplorationController(defaultConfig);
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 10, // Very high
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBeLessThanOrEqual(5);
    });
  });

  describe('recordRecommendation', () => {
    it('should track topic history', () => {
      const controller = new RLExplorationController(defaultConfig);

      controller.recordRecommendation('algebra');
      controller.recordRecommendation('geometry');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');

      expect(controller.getConsecutiveSameTopicCount('algebra')).toBe(2);
      expect(controller.getConsecutiveSameTopicCount('geometry')).toBe(1);
    });
  });

  describe('recordResponse', () => {
    it('should update health metrics', () => {
      const controller = new RLExplorationController(defaultConfig);

      // Record some responses
      controller.recordResponse({ topic: 'algebra', correct: true, complexity: 0.6 });
      controller.recordResponse({ topic: 'algebra', correct: false, complexity: 0.7 });

      const health = controller.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.metrics).toBeDefined();
    });
  });
});
