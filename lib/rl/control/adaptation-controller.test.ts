/**
 * Adaptation Controller Tests
 * TDD: Tests written before implementation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import type { AdaptationConfig } from '../config/phase3-features';

// Import from the module under test
import { AdaptationController } from './adaptation-controller';

describe('AdaptationController', () => {
  let controller: AdaptationController;
  const defaultConfig: AdaptationConfig = {
    baseExplorationRate: 0.1,
    minExplorationRate: 0.01,
    adaptationSpeed: 0.1,
    confidenceThreshold: 0.8,
  };

  beforeEach(() => {
    controller = new AdaptationController(defaultConfig);
  });

  describe('constructor', () => {
    test('should initialize with provided config', () => {
      const customConfig: AdaptationConfig = {
        baseExplorationRate: 0.2,
        minExplorationRate: 0.05,
        adaptationSpeed: 0.2,
        confidenceThreshold: 0.7,
      };
      const customController = new AdaptationController(customConfig);
      const state = customController.getRecommendation();

      expect(state.currentExplorationRate).toBe(0.2);
    });

    test('should use default config when not provided', () => {
      const defaultController = new AdaptationController();
      const state = defaultController.getRecommendation();

      expect(state.currentExplorationRate).toBe(0.1);
    });
  });

  describe('calculateExplorationRate', () => {
    test('should return base rate when confidence and progress are 0', () => {
      const rate = controller.calculateExplorationRate(0, 0);
      expect(rate).toBeCloseTo(0.1, 5);
    });

    test('should decrease rate as confidence increases', () => {
      const rateLow = controller.calculateExplorationRate(0.2, 0);
      const rateHigh = controller.calculateExplorationRate(0.8, 0);
      expect(rateHigh).toBeLessThan(rateLow);
    });

    test('should decrease rate as progress increases', () => {
      const rateLow = controller.calculateExplorationRate(0, 0.2);
      const rateHigh = controller.calculateExplorationRate(0, 0.8);
      expect(rateHigh).toBeLessThan(rateLow);
    });

    test('should never go below minExplorationRate', () => {
      const rate = controller.calculateExplorationRate(0.99, 0.99);
      expect(rate).toBeGreaterThanOrEqual(0.01);
    });

    test('should apply formula correctly', () => {
      // Formula: rate = base * (1-confidence)^speed * (1-progress)^(speed*2)
      // With confidence=0, progress=0: rate = 0.1 * 1 * 1 = 0.1
      const rate = controller.calculateExplorationRate(0, 0);
      expect(rate).toBeCloseTo(0.1, 5);

      // With confidence=0.5, progress=0:
      // rate = 0.1 * (1-0.5)^0.1 * 1 = 0.1 * 0.5^0.1 ≈ 0.1 * 0.933 = 0.0933
      const rate50 = controller.calculateExplorationRate(0.5, 0);
      expect(rate50).toBeLessThan(0.1);
      expect(rate50).toBeGreaterThan(0.08);
    });
  });

  describe('getRecommendation', () => {
    test('should return explore when confidence < 0.4', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: 0.2 });
      const state = controller.getRecommendation();

      expect(state.recommendedAction).toBe('explore');
      expect(state.confidenceLevel).toBeCloseTo(0.2, 5);
    });

    test('should return exploit when confidence > 0.8', () => {
      controller.update({ le: 0.2, cs: 0.9, confidence: 0.9 });
      const state = controller.getRecommendation();

      expect(state.recommendedAction).toBe('exploit');
      expect(state.confidenceLevel).toBeCloseTo(0.9, 5);
    });

    test('should return maintain for 0.4 <= confidence <= 0.8', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: 0.6 });
      const state = controller.getRecommendation();

      expect(state.recommendedAction).toBe('maintain');
      expect(state.confidenceLevel).toBeCloseTo(0.6, 5);
    });

    test('should return maintain when confidence == 0.4', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: 0.4 });
      const state = controller.getRecommendation();

      expect(state.recommendedAction).toBe('maintain');
    });

    test('should return maintain when confidence == 0.8', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: 0.8 });
      const state = controller.getRecommendation();

      expect(state.recommendedAction).toBe('maintain');
    });

    test('should calculate learningProgress from metrics', () => {
      // Learning progress based on LE: higher LE = more progress
      // LE target is 0.15, so 0.2 LE would be ~93% progress
      controller.update({ le: 0.2, cs: 0.85, confidence: 0.5 });
      const state = controller.getRecommendation();

      expect(state.learningProgress).toBeGreaterThan(0);
      expect(state.learningProgress).toBeLessThanOrEqual(1);
    });

    test('should include current exploration rate in state', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: 0.5 });
      const state = controller.getRecommendation();

      expect(state.currentExplorationRate).toBeGreaterThanOrEqual(0.01);
      expect(state.currentExplorationRate).toBeLessThanOrEqual(0.1);
    });
  });

  describe('update', () => {
    test('should update internal state with metrics', () => {
      controller.update({ le: 0.18, cs: 0.9, confidence: 0.7 });
      const state = controller.getRecommendation();

      expect(state.confidenceLevel).toBeCloseTo(0.7, 5);
    });

    test('should recalculate exploration rate on update', () => {
      const stateBefore = controller.getRecommendation();
      controller.update({ le: 0.25, cs: 0.95, confidence: 0.95 });
      const stateAfter = controller.getRecommendation();

      expect(stateAfter.currentExplorationRate).toBeLessThan(stateBefore.currentExplorationRate);
    });

    test('should handle edge case metrics', () => {
      // Zero values
      controller.update({ le: 0, cs: 0, confidence: 0 });
      const state = controller.getRecommendation();

      expect(state.currentExplorationRate).toBeCloseTo(0.1, 5);
      expect(state.recommendedAction).toBe('explore');
      expect(state.confidenceLevel).toBe(0);
    });

    test('should handle perfect metrics', () => {
      controller.update({ le: 1, cs: 1, confidence: 1 });
      const state = controller.getRecommendation();

      expect(state.currentExplorationRate).toBeGreaterThanOrEqual(0.01);
      expect(state.recommendedAction).toBe('exploit');
    });
  });

  describe('boundary conditions', () => {
    test('should clamp confidence between 0 and 1', () => {
      controller.update({ le: 0.15, cs: 0.85, confidence: -0.1 });
      expect(controller.getRecommendation().confidenceLevel).toBe(0);

      controller.update({ le: 0.15, cs: 0.85, confidence: 1.5 });
      expect(controller.getRecommendation().confidenceLevel).toBe(1);
    });

    test('should clamp learning progress between 0 and 1', () => {
      controller.update({ le: -0.1, cs: 0.85, confidence: 0.5 });
      expect(controller.getRecommendation().learningProgress).toBeGreaterThanOrEqual(0);

      controller.update({ le: 5, cs: 0.85, confidence: 0.5 });
      expect(controller.getRecommendation().learningProgress).toBeLessThanOrEqual(1);
    });
  });
});
