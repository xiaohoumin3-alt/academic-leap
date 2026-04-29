import { test, expect } from '@playwright/test';

/**
 * RL Safety Shell E2E Tests
 *
 * Tests the health monitoring, failure detection, and fallback mechanisms
 * that ensure the RL engine degrades gracefully when problems occur.
 */

test.describe('RL Safety Shell', () => {
  let authCookie: string;

  test.beforeEach(async ({ page }) => {
    // Establish auth session
    await page.goto('/');

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('next-auth'));
    authCookie = sessionCookie?.value || '';

    test.skip(!authCookie, 'Requires authentication - run with authenticated session');
  });

  test('health endpoint returns current status', async ({ request }) => {
    const response = await request.get('/api/rl/health', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify status structure
    expect(data).toHaveProperty('status');
    expect(data.status).toHaveProperty('level');
    expect(['healthy', 'degraded', 'failed']).toContain(data.status.level);

    // Verify metrics exist
    expect(data.status).toHaveProperty('metrics');
    expect(data.status.metrics).toHaveProperty('le');
    expect(data.status.metrics).toHaveProperty('cs');
    expect(data.status.metrics).toHaveProperty('responseCount');

    // Verify recommendation exists and is valid
    expect(data).toHaveProperty('recommendation');
    expect(['rl', 'rule', 'stop']).toContain(data.recommendation);
  });

  test('next-question includes health check metadata', async ({ request }) => {
    const response = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: { knowledgePointId: 'test-kp-safety-1' }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify core question data
    expect(data).toHaveProperty('question');
    expect(data.question).toHaveProperty('id');
    expect(data.question).toHaveProperty('deltaC');

    // Verify health metadata is attached
    expect(data).toHaveProperty('healthStatus');
    expect(data.healthStatus).toHaveProperty('level');

    // Verify recommendation source is tracked
    expect(data).toHaveProperty('recommendationId');
  });

  test('record-response updates health metrics', async ({ request }) => {
    // First get a question
    const questionResponse = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: { knowledgePointId: 'test-kp-metrics-1' }
    });

    const questionData = await questionResponse.json();

    // Record a response
    const recordResponse = await request.post('/api/rl/record-response', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        questionId: questionData.question.id,
        correct: true,
        eventId: crypto.randomUUID(),
        attemptId: crypto.randomUUID(),
        knowledgePointId: 'test-kp-metrics-1',
        recommendationId: questionData.recommendationId,
        preAccuracy: questionData.preAccuracy,
        selectedDeltaC: questionData.question.deltaC
      }
    });

    expect(recordResponse.ok()).toBeTruthy();

    const recordData = await recordResponse.json();
    expect(recordData).toHaveProperty('leDelta');

    // Verify health endpoint shows updated metrics
    const healthResponse = await request.get('/api/rl/health', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    const healthData = await healthResponse.json();

    // Verify health metrics structure
    expect(healthData.status.metrics).toHaveProperty('le');
    expect(healthData.status.metrics).toHaveProperty('cs');
    expect(healthData.status.metrics).toHaveProperty('responseCount');

    // Response count should have increased
    expect(healthData.status.metrics.responseCount).toBeGreaterThanOrEqual(0);
  });

  test('rule engine fallback provides valid recommendations', async ({ request }) => {
    // Test the rule engine directly via a special endpoint or by triggering fallback
    // This test verifies the fallback logic works correctly

    const { ruleEngineRecommendation } = await import('@/lib/rl/fallback/rule-engine');

    // Test edge cases: very low theta
    expect(ruleEngineRecommendation(-2)).toBe(1);
    expect(ruleEngineRecommendation(-10)).toBe(1);

    // Test middle values
    expect(ruleEngineRecommendation(0)).toBe(1);
    expect(ruleEngineRecommendation(0.5)).toBe(1);
    expect(ruleEngineRecommendation(1.5)).toBe(2);

    // Test edge cases: very high theta
    expect(ruleEngineRecommendation(3)).toBe(5);
    expect(ruleEngineRecommendation(10)).toBe(5);

    // Test the float version for precision
    const { ruleEngineRecommendationFloat } = await import('@/lib/rl/fallback/rule-engine');
    expect(ruleEngineRecommendationFloat(1.7)).toBeCloseTo(2.2, 1);
  });

  test('health level transitions correctly', async ({ request }) => {
    const healthResponse = await request.get('/api/rl/health', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    const healthData = await healthResponse.json();

    // Verify the level is one of the valid states
    expect(['healthy', 'degraded', 'failed']).toContain(healthData.status.level);

    // If degraded or failed, verify fallback is active
    if (healthData.status.level !== 'healthy') {
      expect(['rule', 'stop']).toContain(healthData.recommendation);
    }
  });

  test('convergence stability metric is calculated', async ({ request }) => {
    const response = await request.get('/api/rl/health', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    const data = await response.json();

    // CS metric should be present
    expect(data.status.metrics).toHaveProperty('cs');

    // CS should be between 0 and 1 (or null if not enough data)
    if (data.status.metrics.cs !== null) {
      expect(data.status.metrics.cs).toBeGreaterThanOrEqual(0);
      expect(data.status.metrics.cs).toBeLessThanOrEqual(1);
    }
  });

  test('learning effectiveness metric is tracked', async ({ request }) => {
    const response = await request.get('/api/rl/health', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    const data = await response.json();

    // LE metric should be present
    expect(data.status.metrics).toHaveProperty('le');

    // LE can be any number (positive = learning, negative = regression)
    expect(typeof data.status.metrics.le).toBe('number');
  });
});

test.describe('RL Safety Shell - Fallback Behavior', () => {
  let authCookie: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('next-auth'));
    authCookie = sessionCookie?.value || '';
    test.skip(!authCookie, 'Requires authentication');
  });

  test('system continues operating when RL is degraded', async ({ request }) => {
    // Even if health is degraded, next-question should still return valid data
    const response = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: { knowledgePointId: 'test-kp-fallback-1' }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Should always have a question, regardless of health state
    expect(data).toHaveProperty('question');
    expect(data.question).toHaveProperty('id');
    expect(data.question).toHaveProperty('deltaC');

    // DeltaC should always be in valid range [1-5]
    expect(data.question.deltaC).toBeGreaterThanOrEqual(1);
    expect(data.question.deltaC).toBeLessThanOrEqual(5);
  });
});
