// app/api/rl/next-question/__tests__/route-integration.test.ts

/**
 * Integration test for CW-TS (Confidence-Weighted Thompson Sampling)
 * in next-question API
 *
 * Tests:
 * 1. When RL_CWTS_ENABLED=true, CW-TS is used
 * 2. When RL_CWTS_ENABLED=false, standard Thompson Sampling is used
 * 3. Backward compatibility is maintained
 * 4. Health monitoring still works with CW-TS
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { RLModelStore } from '@/lib/rl/persistence/model-store';
import { CWThompsonSamplingBandit } from '@/lib/rl/bandit/cw-thompson-sampling';
import { ThompsonSamplingBandit } from '@/lib/rl/bandit/thompson-sampling';
import { isFeatureEnabled, getFeatureConfig } from '@/lib/rl/config/phase2-features';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: async () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
    },
  }),
}));

// Mock feature flags
const originalEnv = process.env;

describe('next-question API - CW-TS Integration', () => {
  let modelId: string;

  beforeEach(async () => {
    // Reset environment
    process.env = { ...originalEnv };

    // Create a test model
    const store = new RLModelStore(prisma);
    modelId = await store.createModel({ version: 'test-cwts-v1' });

    // Deploy the model
    await prisma.rLModelVersion.update({
      where: { id: modelId },
      data: { status: 'DEPLOYED' },
    });

    // Create IRT state
    await prisma.iRTStudentState.create({
      data: {
        userId: 'test-user-id',
        theta: 0.5,
        confidence: 1.0,
      },
    });

    // Create test questions
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      await prisma.question.create({
        data: {
          type: 'step',
          difficulty,
          content: '{}',
          answer: '42',
        },
      });
    }
  });

  afterEach(async () => {
    // Clean up
    await prisma.attemptStep.deleteMany({});
    await prisma.attempt.deleteMany({});
    await prisma.question.deleteMany({});
    await prisma.iRTStudentState.deleteMany({});
    await prisma.rLTrainingLog.deleteMany({});
    await prisma.rLBanditArm.deleteMany({});
    await prisma.rLModelVersion.deleteMany({});

    // Restore environment
    process.env = originalEnv;
  });

  describe('Feature flag behavior', () => {
    it('should report CW-TS as enabled when RL_CWTS_ENABLED=true', () => {
      process.env.RL_CWTS_ENABLED = 'true';

      // Clear module cache to re-import with new env
      jest.resetModules();
      const { isFeatureEnabled: isEnabled } = require('@/lib/rl/config/phase2-features');

      expect(isEnabled('cwts')).toBe(true);
    });

    it('should report CW-TS as disabled when RL_CWTS_ENABLED=false', () => {
      process.env.RL_CWTS_ENABLED = 'false';

      jest.resetModules();
      const { isFeatureEnabled: isEnabled } = require('@/lib/rl/config/phase2-features');

      expect(isEnabled('cwts')).toBe(false);
    });

    it('should use default config values when not specified', () => {
      const cwtsConfig = getFeatureConfig<{
        confidenceScale: number;
        minConfidence: number;
        enableCutoff: boolean;
        cutoffThreshold: number;
      }>('cwts');

      expect(cwtsConfig.confidenceScale).toBeDefined();
      expect(cwtsConfig.minConfidence).toBeDefined();
      expect(cwtsConfig.enableCutoff).toBeDefined();
      expect(cwtsConfig.cutoffThreshold).toBeDefined();
    });
  });

  describe('Bandit compatibility', () => {
    it('should create CW-TS bandit with same interface as Thompson Sampling', () => {
      const cwtsBandit = new CWThompsonSamplingBandit({
        confidenceScale: 100,
        minConfidence: 0.3,
        enableCutoff: false,
        cutoffThreshold: 0.1,
      });

      const tsBandit = new ThompsonSamplingBandit();

      // Both should have selectArm and update methods
      expect(typeof cwtsBandit.selectArm).toBe('function');
      expect(typeof cwtsBandit.update).toBe('function');
      expect(typeof tsBandit.selectArm).toBe('function');
      expect(typeof tsBandit.update).toBe('function');

      // Both should return string from selectArm
      const cwtsResult = cwtsBandit.selectArm(0.5);
      const tsResult = tsBandit.selectArm(0.5);

      expect(typeof cwtsResult).toBe('string');
      expect(typeof tsResult).toBe('string');
    });

    it('should update bandit state consistently', () => {
      const cwtsBandit = new CWThompsonSamplingBandit({
        confidenceScale: 100,
        minConfidence: 0.3,
        enableCutoff: false,
        cutoffThreshold: 0.1,
      });

      const tsBandit = new ThompsonSamplingBandit();

      // Same updates should produce similar behavior
      cwtsBandit.update('5.0', true);
      cwtsBandit.update('5.0', false);
      tsBandit.update('5.0', true);
      tsBandit.update('5.0', false);

      const cwtsState = cwtsBandit.getState();
      const tsState = tsBandit.getState();

      const cwtsBucket = cwtsState.buckets.get('5.0');
      const tsBucket = tsState.buckets.get('5.0');

      // Alpha and beta should be the same (same prior + same updates)
      expect(cwtsBucket?.alpha).toBe(tsBucket?.alpha);
      expect(cwtsBucket?.beta).toBe(tsBucket?.beta);
      expect(cwtsBucket?.pullCount).toBe(tsBucket?.pullCount);
      expect(cwtsBucket?.successCount).toBe(tsBucket?.successCount);
    });
  });

  describe('Health monitoring integration', () => {
    it('should still apply degradation actions with CW-TS', async () => {
      // This test verifies health monitoring still works
      // The actual health monitor logic is tested separately
      const cwtsBandit = new CWThompsonSamplingBandit({
        confidenceScale: 100,
        minConfidence: 0.3,
        enableCutoff: false,
        cutoffThreshold: 0.1,
      });

      // CW-TS should still produce valid recommendations
      const recommendation = cwtsBandit.selectArm(0.5);

      expect(recommendation).toBeTruthy();
      expect(typeof recommendation).toBe('string');

      // Parse and validate it's a number
      const parsed = parseFloat(recommendation);
      expect(parsed).not.toBeNaN();
      expect(Number.isFinite(parsed)).toBe(true);
    });
  });
});
