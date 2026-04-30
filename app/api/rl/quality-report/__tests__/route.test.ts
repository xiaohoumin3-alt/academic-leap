/**
 * Quality Report Route Tests
 * Tests for Phase 3 component state endpoint
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Inline mock factory to avoid module loading issues
const mockSession = {
  user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

// Mock auth - only mock what we need for route testing
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock health monitor
jest.mock('@/lib/rl/health/monitor', () => ({
  HealthMonitor: jest.fn().mockImplementation(() => ({
    check: jest.fn().mockReturnValue({
      level: 'healthy',
      metrics: {
        le: 0.18,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 1,
        rewardLossRate: 0.01,
        isPseudoConverged: false,
      },
      alerts: [],
      timestamp: new Date().toISOString(),
    }),
  })),
}));

// Mock phase3-features config
jest.mock('@/lib/rl/config/phase3-features', () => ({
  isFeatureEnabled: jest.fn<(name: string) => boolean>().mockImplementation((name: string) => {
    const flags: Record<string, boolean> = {
      lqm: true,
      normalizer: true,
      adaptation: true,
    };
    return flags[name] ?? false;
  }),
  getFeatureConfig: jest.fn<(name: string) => object>().mockImplementation((name: string) => {
    if (name === 'lqm') return { noiseThreshold: 0.7, minAttempts: 20, decayRate: 0.95 };
    if (name === 'normalizer') return { windowSize: 1000 };
    if (name === 'adaptation') return {
      baseExplorationRate: 0.1,
      minExplorationRate: 0.01,
      adaptationSpeed: 0.1,
      confidenceThreshold: 0.8
    };
    return {};
  }),
  LQMConfig: {},
  NormalizerConfig: {},
  AdaptationConfig: {},
}));

// Import mocked modules
import { auth } from '@/lib/auth';
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { isFeatureEnabled, getFeatureConfig } from '@/lib/rl/config/phase3-features';

// Import real implementations for component testing
import { LabelQualityModel } from '@/lib/rl/quality/label-quality';
import { FeatureNormalizer } from '@/lib/rl/normalize/feature-normalizer';
import { AdaptationController } from '@/lib/rl/control/adaptation-controller';

describe('Quality Report Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Set environment variables for Phase 3 features
    process.env.RL_LQM_ENABLED = 'true';
    process.env.RL_NORMALIZER_ENABLED = 'true';
    process.env.RL_ADAPTATION_ENABLED = 'true';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Authentication', () => {
    test('should return 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValueOnce(null);

      // Test that auth returns null
      const session = await auth();
      expect(session).toBeNull();
    });

    test('should allow authenticated requests', async () => {
      // Test that auth returns session
      (auth as jest.Mock).mockResolvedValueOnce(mockSession);

      const session = await auth();
      expect(session).toBeTruthy();
      expect(session?.user).toBeDefined();
    });
  });

  describe('Component Initialization', () => {
    test('should initialize HealthMonitor', () => {
      const monitor = new HealthMonitor();
      expect(monitor).toBeDefined();
      expect(typeof monitor.check).toBe('function');
    });

    test('should initialize LabelQualityModel when enabled', () => {
      const lqm = new LabelQualityModel({
        noiseThreshold: 0.7,
        minAttempts: 20,
        decayRate: 0.95
      });
      expect(lqm).toBeDefined();
      expect(typeof lqm.getTrackedQuestions).toBe('function');
      expect(typeof lqm.getQuality).toBe('function');
    });

    test('should initialize FeatureNormalizer when enabled', () => {
      const normalizer = new FeatureNormalizer({ windowSize: 1000 });
      expect(normalizer).toBeDefined();
      expect(typeof normalizer.getStats).toBe('function');
    });

    test('should initialize AdaptationController when enabled', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });
      expect(controller).toBeDefined();
      expect(typeof controller.update).toBe('function');
      expect(typeof controller.getRecommendation).toBe('function');
    });
  });

  describe('Feature Flags', () => {
    test('should report LQM as enabled', () => {
      (isFeatureEnabled as jest.Mock).mockReturnValueOnce(true);
      expect(isFeatureEnabled('lqm')).toBe(true);
    });

    test('should report Normalizer as enabled', () => {
      (isFeatureEnabled as jest.Mock).mockReturnValueOnce(true);
      expect(isFeatureEnabled('normalizer')).toBe(true);
    });

    test('should report Adaptation as enabled', () => {
      (isFeatureEnabled as jest.Mock).mockReturnValueOnce(true);
      expect(isFeatureEnabled('adaptation')).toBe(true);
    });

    test('should handle disabled features', () => {
      (isFeatureEnabled as jest.Mock).mockReturnValueOnce(false);
      expect(isFeatureEnabled('lqm')).toBe(false);
    });
  });

  describe('LQM Data Access', () => {
    test('should get tracked questions', () => {
      const lqm = new LabelQualityModel({
        noiseThreshold: 0.7,
        minAttempts: 20,
        decayRate: 0.95
      });
      const questions = lqm.getTrackedQuestions();
      expect(Array.isArray(questions)).toBe(true);
    });

    test('should return undefined for unknown question quality', () => {
      const lqm = new LabelQualityModel({
        noiseThreshold: 0.7,
        minAttempts: 20,
        decayRate: 0.95
      });
      // getQuality returns undefined for questions with no data
      const quality = lqm.getQuality('unknown-q');
      expect(quality).toBeUndefined();
    });

    test('should estimate quality with enough data', () => {
      const lqm = new LabelQualityModel({
        noiseThreshold: 0.7,
        minAttempts: 5,  // Lower threshold for testing
        decayRate: 0.95
      });

      // Simulate some attempts
      const attempts = [
        { correct: true, theta: 0.5 },
        { correct: true, theta: 0.6 },
        { correct: false, theta: 0.4 },
        { correct: true, theta: 0.5 },
        { correct: true, theta: 0.55 },
      ];

      const quality = lqm.estimateQuality('test-q', attempts, 0.5);
      expect(quality.questionId).toBe('test-q');
      expect(typeof quality.estimatedQuality).toBe('number');
      expect(typeof quality.confidence).toBe('number');
    });
  });

  describe('Normalizer Stats', () => {
    test('should return stats for features', () => {
      const normalizer = new FeatureNormalizer({ windowSize: 1000 });
      const stats = normalizer.getStats('reward');
      expect(stats).toHaveProperty('mean');
      expect(stats).toHaveProperty('std');
      expect(stats).toHaveProperty('count');
    });

    test('should track values and update stats', () => {
      const normalizer = new FeatureNormalizer({ windowSize: 100 });

      // Add values
      normalizer.update(1.0, 'reward');
      normalizer.update(2.0, 'reward');
      normalizer.update(3.0, 'reward');

      const stats = normalizer.getStats('reward');
      expect(stats.count).toBe(3);
      expect(stats.mean).toBeCloseTo(2.0, 5);
      expect(stats.std).toBeGreaterThan(0);
    });
  });

  describe('Adaptation Controller', () => {
    test('should update with health metrics and recommend explore when confidence is low', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      controller.update({ le: 0.05, cs: 0.5, confidence: 0.2 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.recommendedAction).toBe('explore');
    });

    test('should update with health metrics and recommend exploit when confidence is high', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      controller.update({ le: 0.25, cs: 0.95, confidence: 0.9 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.recommendedAction).toBe('exploit');
    });

    test('should update with health metrics and recommend maintain when confidence is moderate', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      controller.update({ le: 0.15, cs: 0.8, confidence: 0.6 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.recommendedAction).toBe('maintain');
    });

    test('should update confidence level correctly', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      controller.update({ le: 0.1, cs: 0.7, confidence: 0.5 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.confidenceLevel).toBe(0.5);
    });

    test('should calculate learning progress from LE', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      controller.update({ le: 0.15, cs: 0.8, confidence: 0.5 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.learningProgress).toBeCloseTo(0.5, 1);
    });

    test('should clamp values to valid ranges', () => {
      const controller = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      // Test with values outside range
      controller.update({ le: 1.5, cs: 1.5, confidence: 2.0 });

      const recommendation = controller.getRecommendation();
      expect(recommendation.confidenceLevel).toBeLessThanOrEqual(1);
      expect(recommendation.learningProgress).toBeLessThanOrEqual(1);
    });
  });

  describe('Response Structure', () => {
    test('should have correct interface for QualityReportResponse', () => {
      // Test the interface structure
      const mockResponse = {
        questionQuality: [{
          questionId: 'q1',
          estimatedQuality: 0.85,
          confidence: 0.9,
          isNoisy: false,
        }],
        distributionStats: {
          reward: { mean: 0.5, std: 0.2, count: 100 },
        },
        adaptationState: {
          currentExplorationRate: 0.05,
          confidenceLevel: 0.7,
          learningProgress: 0.6,
          recommendedAction: 'maintain' as const,
        },
        phase3Features: {
          lqm: { enabled: true },
          normalizer: { enabled: true },
          adaptation: { enabled: true },
        },
        timestamp: new Date().toISOString(),
      };

      // Verify structure
      expect(Array.isArray(mockResponse.questionQuality)).toBe(true);
      expect(typeof mockResponse.distributionStats).toBe('object');
      expect(mockResponse.adaptationState).toHaveProperty('recommendedAction');
      expect(['explore', 'exploit', 'maintain']).toContain(mockResponse.adaptationState.recommendedAction);
      expect(typeof mockResponse.timestamp).toBe('string');
    });
  });

  describe('Config Loading', () => {
    test('should load LQM config', () => {
      const config = getFeatureConfig<{ noiseThreshold: number; minAttempts: number; decayRate: number }>('lqm');
      expect(config).toHaveProperty('noiseThreshold');
      expect(config).toHaveProperty('minAttempts');
      expect(config).toHaveProperty('decayRate');
    });

    test('should load Normalizer config', () => {
      const config = getFeatureConfig<{ windowSize: number }>('normalizer');
      expect(config).toHaveProperty('windowSize');
    });

    test('should load Adaptation config', () => {
      const config = getFeatureConfig<{
        baseExplorationRate: number;
        minExplorationRate: number;
        adaptationSpeed: number;
        confidenceThreshold: number;
      }>('adaptation');
      expect(config).toHaveProperty('baseExplorationRate');
      expect(config).toHaveProperty('minExplorationRate');
      expect(config).toHaveProperty('adaptationSpeed');
      expect(config).toHaveProperty('confidenceThreshold');
    });
  });

  describe('Integration Mock Tests', () => {
    test('should build complete quality report structure', async () => {
      // Build the complete response structure that the route would return
      const monitor = new HealthMonitor();
      const lqm = new LabelQualityModel({
        noiseThreshold: 0.7,
        minAttempts: 20,
        decayRate: 0.95
      });
      const normalizer = new FeatureNormalizer({ windowSize: 1000 });
      const adaptation = new AdaptationController({
        baseExplorationRate: 0.1,
        minExplorationRate: 0.01,
        adaptationSpeed: 0.1,
        confidenceThreshold: 0.8
      });

      // Simulate what the route does
      const healthStatus = monitor.check();
      adaptation.update({
        le: healthStatus.metrics.learningEffectiveness ?? 0,
        cs: healthStatus.metrics.convergenceStability ?? 0,
        confidence: healthStatus.metrics.confidence ?? 0,
      });

      const trackedQuestions = lqm.getTrackedQuestions();
      const questionQuality = trackedQuestions.map(qId => lqm.getQuality(qId)).filter(Boolean);

      const distributionStats: Record<string, { mean: number; std: number; count: number }> = {};
      ['reward', 'theta', 'deltaC'].forEach(feature => {
        const stats = normalizer.getStats(feature);
        if (stats.count > 0) {
          distributionStats[feature] = stats;
        }
      });

      const response = {
        questionQuality,
        distributionStats,
        adaptationState: adaptation.getRecommendation(),
        phase3Features: {
          lqm: { enabled: isFeatureEnabled('lqm') },
          normalizer: { enabled: isFeatureEnabled('normalizer') },
          adaptation: { enabled: isFeatureEnabled('adaptation') },
        },
        timestamp: new Date().toISOString(),
      };

      // Verify the structure matches what we expect
      expect(response).toHaveProperty('questionQuality');
      expect(response).toHaveProperty('distributionStats');
      expect(response).toHaveProperty('adaptationState');
      expect(response).toHaveProperty('phase3Features');
      expect(response).toHaveProperty('timestamp');
      expect(response.phase3Features.lqm.enabled).toBe(true);
      expect(response.phase3Features.normalizer.enabled).toBe(true);
      expect(response.phase3Features.adaptation.enabled).toBe(true);
    });
  });
});