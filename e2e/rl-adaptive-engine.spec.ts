import { test, expect } from '@playwright/test';

test.describe('RL Adaptive Engine API', () => {
  let authCookie: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to home to establish auth session
    await page.goto('/');

    // Get auth cookie after login (assuming test user is already logged in)
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('next-auth'));
    authCookie = sessionCookie?.value || '';

    // If no auth, skip these tests
    test.skip(!authCookie, 'Requires authentication');
  });

  test('GET /api/rl/student-state - returns initial student state', async ({ request }) => {
    const response = await request.get('/api/rl/student-state', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('irt');
    expect(data).toHaveProperty('knowledgePoints');

    expect(data.irt).toMatchObject({
      theta: expect.any(Number),
      confidence: expect.any(Number),
      responseCount: expect.any(Number)
    });

    expect(Array.isArray(data.knowledgePoints)).toBe(true);
  });

  test('POST /api/rl/next-question - returns question recommendation', async ({ request }) => {
    const response = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        knowledgePointId: 'test-kp-001'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('question');
    expect(data).toHaveProperty('theta');
    expect(data).toHaveProperty('selectedBucket');
    expect(data).toHaveProperty('modelVersion');
    expect(data).toHaveProperty('recommendationId');
    expect(data).toHaveProperty('preAccuracy');

    expect(data.question).toHaveProperty('id');
    expect(data.question).toHaveProperty('deltaC');
  });

  test('POST /api/rl/next-question - requires knowledgePointId', async ({ request }) => {
    const response = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {}
    });

    expect(response.status()).toBe(400);
  });

  test('POST /api/rl/record-response - records answer and updates IRT', async ({ request }) => {
    // First get a recommendation
    const nextResponse = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        knowledgePointId: 'test-kp-002'
      }
    });

    const nextData = await nextResponse.json();

    // Then record response
    const recordResponse = await request.post('/api/rl/record-response', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        questionId: nextData.question.id,
        correct: true,
        eventId: `test-event-${Date.now()}`,
        attemptId: `test-attempt-${Date.now()}`,
        knowledgePointId: 'test-kp-002',
        recommendationId: nextData.recommendationId,
        preAccuracy: nextData.preAccuracy,
        selectedDeltaC: nextData.question.deltaC
      }
    });

    expect(recordResponse.status()).toBe(200);

    const recordData = await recordResponse.json();
    expect(recordData).toHaveProperty('reward');
    expect(recordData).toHaveProperty('thetaBefore');
    expect(recordData).toHaveProperty('thetaAfter');
    expect(recordData).toHaveProperty('preAccuracy');
    expect(recordData).toHaveProperty('postAccuracy');
    expect(recordData).toHaveProperty('leDelta');
    expect(recordData).toHaveProperty('logId');
  });

  test('POST /api/rl/record-response - requires tracking fields', async ({ request }) => {
    const response = await request.post('/api/rl/record-response', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        questionId: 'q123',
        correct: true
        // Missing: eventId, attemptId, knowledgePointId, recommendationId
      }
    });

    expect(response.status()).toBe(400);
  });

  test('full learning loop - question → answer → state update', async ({ request }) => {
    const kpId = `test-kp-loop-${Date.now()}`;

    // Step 1: Get initial state
    const initialState = await request.get('/api/rl/student-state', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });
    expect(initialState.status()).toBe(200);
    const initialData = await initialState.json();
    const initialTheta = initialData.irt.theta;

    // Step 2: Get next question
    const nextResponse = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: { knowledgePointId: kpId }
    });
    expect(nextResponse.status()).toBe(200);
    const nextData = await nextResponse.json();

    // Step 3: Record correct answer
    const recordResponse = await request.post('/api/rl/record-response', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        questionId: nextData.question.id,
        correct: true,
        eventId: `loop-event-${Date.now()}`,
        attemptId: `loop-attempt-${Date.now()}`,
        knowledgePointId: kpId,
        recommendationId: nextData.recommendationId,
        preAccuracy: nextData.preAccuracy,
        selectedDeltaC: nextData.question.deltaC
      }
    });
    expect(recordResponse.status()).toBe(200);
    const recordData = await recordResponse.json();

    // Verify learning occurred
    expect(recordData.leDelta).toBeGreaterThanOrEqual(0);

    // Step 4: Check state was updated
    const finalState = await request.get('/api/rl/student-state', {
      headers: {
        Cookie: `next-auth.session-token=${authCookie}`
      }
    });
    expect(finalState.status()).toBe(200);
    const finalData = await finalState.json();

    // Response count should increase
    expect(finalData.irt.responseCount).toBeGreaterThan(initialData.irt.responseCount);
  });

  test('DFI compliance - all tracking IDs present', async ({ request }) => {
    const kpId = `dfi-test-${Date.now()}`;

    // Get question
    const nextResponse = await request.post('/api/rl/next-question', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: { knowledgePointId: kpId }
    });
    const nextData = await nextResponse.json();

    // Verify recommendation ID exists
    expect(nextData.recommendationId).toBeTruthy();
    expect(nextData.recommendationId).toMatch(/^[0-9a-f-]+$/); // UUID format

    // Record response
    const recordResponse = await request.post('/api/rl/record-response', {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `next-auth.session-token=${authCookie}`
      },
      data: {
        questionId: nextData.question.id,
        correct: false,
        eventId: `dfi-event-${Date.now()}`,
        attemptId: `dfi-attempt-${Date.now()}`,
        knowledgePointId: kpId,
        recommendationId: nextData.recommendationId,
        preAccuracy: nextData.preAccuracy,
        selectedDeltaC: nextData.question.deltaC
      }
    });
    const recordData = await recordResponse.json();

    // Verify log ID exists (training was logged)
    expect(recordData.logId).toBeTruthy();
  });
});
