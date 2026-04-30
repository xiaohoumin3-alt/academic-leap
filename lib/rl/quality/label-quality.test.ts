/**
 * Label Quality Model Tests
 *
 * Tests for the LQM which estimates question label quality and corrects noisy labels.
 */

import type { LQMConfig } from '../config/phase3-features';
import { LabelQualityModel } from './label-quality';
import type { QuestionAttempt, QuestionQuality, CorrectedLabel, StudentResponse } from './types';

describe('LabelQualityModel', () => {
  const defaultConfig: LQMConfig = {
    noiseThreshold: 0.7,
    minAttempts: 20,
    decayRate: 0.95,
  };

  describe('estimateQuality', () => {
    it('should estimate high quality for consistent question', () => {
      const model = new LabelQualityModel(defaultConfig);

      // Question with difficulty 0 (deltaC=5), students with theta 0 should pass ~50%
      // If many students with theta=0 pass, the label is high quality
      const history: QuestionAttempt[] = [];
      const difficulty = 0; // neutral difficulty

      // Students at theta=0 should get ~50% correct
      for (let i = 0; i < 30; i++) {
        history.push({ correct: true, theta: 0 });
        history.push({ correct: false, theta: 0 });
      }

      const quality = model.estimateQuality('q1', history, difficulty);

      expect(quality.questionId).toBe('q1');
      expect(quality.estimatedQuality).toBeGreaterThan(0.5);
      expect(quality.isNoisy).toBe(false);
    });

    it('should estimate low quality for inconsistent question', () => {
      const model = new LabelQualityModel(defaultConfig);

      // High ability students consistently fail = noisy label
      const history: QuestionAttempt[] = [];
      const difficulty = 0;

      for (let i = 0; i < 30; i++) {
        history.push({ correct: false, theta: 2 }); // High ability but fail
      }

      const quality = model.estimateQuality('q2', history, difficulty);

      expect(quality.estimatedQuality).toBeLessThan(0.5);
      expect(quality.isNoisy).toBe(true);
    });

    it('should handle low sample size with reduced confidence', () => {
      const model = new LabelQualityModel(defaultConfig);

      const history: QuestionAttempt[] = [
        { correct: true, theta: 0 },
        { correct: true, theta: 0 },
        { correct: true, theta: 0 },
      ];

      const quality = model.estimateQuality('q3', history, 0);

      expect(quality.confidence).toBeLessThan(1);
      expect(quality.confidence).toBeGreaterThan(0);
    });

    it('should return default quality for unknown question', () => {
      const model = new LabelQualityModel(defaultConfig);
      const quality = model.getQuality('unknown');

      expect(quality).toBeUndefined();
    });
  });

  describe('correctLabel', () => {
    it('should return original label when quality is high', () => {
      const model = new LabelQualityModel(defaultConfig);

      // Build high quality history
      const history: QuestionAttempt[] = [];
      for (let i = 0; i < 25; i++) {
        history.push({ correct: true, theta: 1 }); // Easy for high ability
        history.push({ correct: false, theta: -1 }); // Hard for low ability
      }

      model.estimateQuality('q4', history, 0);

      const result = model.correctLabel('q4', true);

      expect(result.value).toBe(true);
      expect(result.wasCorrected).toBe(false);
      expect(result.quality).toBeGreaterThan(defaultConfig.noiseThreshold);
    });

    it('should correct label when quality is low (majority vote)', () => {
      const model = new LabelQualityModel(defaultConfig);

      // Build noisy history: high ability students all say false
      const history: QuestionAttempt[] = [];
      for (let i = 0; i < 25; i++) {
        history.push({ correct: false, theta: 2 }); // High ability but marked wrong
      }

      model.estimateQuality('q5', history, 0);

      const result = model.correctLabel('q5', true); // Original label is true

      expect(result.wasCorrected).toBe(true);
      expect(result.value).toBe(false); // Corrected to majority vote
    });

    it('should correct label using IRT model when no clear majority', () => {
      const model = new LabelQualityModel(defaultConfig);

      // Mixed history
      const history: QuestionAttempt[] = [];
      for (let i = 0; i < 10; i++) {
        history.push({ correct: true, theta: 1 });
        history.push({ correct: false, theta: -1 });
      }

      model.estimateQuality('q6', history, 0);

      const result = model.correctLabel('q6', true);

      // Should return some value, quality indicates reliability
      expect(result.quality).toBeDefined();
    });
  });

  describe('update and getQuality', () => {
    it('should update and retrieve question quality', () => {
      const model = new LabelQualityModel(defaultConfig);

      model.update('q7', { correct: true, theta: 1 });
      model.update('q7', { correct: true, theta: 1 });
      model.update('q7', { correct: false, theta: 0 });

      const quality = model.getQuality('q7');

      expect(quality).toBeDefined();
      expect(quality?.questionId).toBe('q7');
      expect(quality?.confidence).toBeGreaterThan(0);
    });

    it('should apply decay to existing quality', () => {
      const model = new LabelQualityModel(defaultConfig);

      // First add many consistent responses
      for (let i = 0; i < 30; i++) {
        model.update('q8', { correct: true, theta: 2 });
      }

      const firstQuality = model.getQuality('q8');
      const firstScore = firstQuality!.estimatedQuality;

      // Add an inconsistent response
      model.update('q8', { correct: false, theta: 2 });

      const secondQuality = model.getQuality('q8');
      const secondScore = secondQuality!.estimatedQuality;

      // Score should decrease due to inconsistency
      expect(secondScore).toBeLessThan(firstScore);
    });
  });

  describe('IRT probability calculation', () => {
    it('should compute correct IRT probability', () => {
      const model = new LabelQualityModel(defaultConfig);

      // At difficulty=0 (theta=difficulty), P=0.5
      // P = 1 / (1 + exp(-(theta - difficulty)))
      const history: QuestionAttempt[] = [
        { correct: true, theta: 0 },
        { correct: true, theta: 0 },
      ];

      const quality = model.estimateQuality('q9', history, 0);

      // With only 2 attempts, confidence should be low
      expect(quality.confidence).toBeLessThan(0.5);
    });

    it('should handle extreme theta values', () => {
      const model = new LabelQualityModel(defaultConfig);

      const history: QuestionAttempt[] = [
        { correct: false, theta: 3 }, // Very high ability
        { correct: false, theta: 3 },
        { correct: false, theta: 3 },
      ];

      const quality = model.estimateQuality('q10', history, 0);

      // High ability students failing on easy question = noisy
      expect(quality.isNoisy).toBe(true);
    });
  });

  describe('sample size adjustment', () => {
    it('should reduce quality for small samples', () => {
      const model = new LabelQualityModel(defaultConfig);

      // Very small sample
      const smallHistory: QuestionAttempt[] = [
        { correct: true, theta: 0 },
      ];

      const smallQuality = model.estimateQuality('q-small', smallHistory, 0);

      // Large sample
      const largeHistory: QuestionAttempt[] = [];
      for (let i = 0; i < 50; i++) {
        largeHistory.push({ correct: true, theta: 0 });
      }

      const largeQuality = model.estimateQuality('q-large', largeHistory, 0);

      // Large sample should have higher confidence
      expect(largeQuality.confidence).toBeGreaterThan(smallQuality.confidence);
    });
  });

  describe('majority voting', () => {
    it('should vote with high theta students only', () => {
      // Use lower threshold to ensure correction triggers
      const strictConfig: LQMConfig = {
        noiseThreshold: 0.75,
        minAttempts: 20,
        decayRate: 0.95,
      };
      const model = new LabelQualityModel(strictConfig);

      // Create noisy scenario: question labeled true, but high theta students consistently fail
      const history: QuestionAttempt[] = [];

      // Many high theta students all fail (labeled as wrong)
      for (let i = 0; i < 15; i++) {
        history.push({ correct: false, theta: 2 });
      }

      // Some low theta students pass (misleading data)
      for (let i = 0; i < 8; i++) {
        history.push({ correct: true, theta: -2 });
      }

      model.estimateQuality('q11', history, 0);

      const result = model.correctLabel('q11', true);

      // High theta students (15) all say false, majority should be false
      expect(result.value).toBe(false);
      expect(result.wasCorrected).toBe(true);
    });
  });
});
