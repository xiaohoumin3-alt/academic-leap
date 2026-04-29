// lib/rl/persistence/model-store.test.ts

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RLModelStore } from './model-store';
import { ThompsonSamplingBandit } from '../bandit/thompson-sampling';
import { prisma } from '../../prisma';

describe('RLModelStore', () => {
  let store: RLModelStore;

  beforeEach(() => {
    store = new RLModelStore(prisma);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.rLTrainingLog.deleteMany({});
    await prisma.rLBanditArm.deleteMany({});
    await prisma.rLModelVersion.deleteMany({});
  });

  it('should create model with arms', async () => {
    const modelId = await store.createModel({ version: 'v1.0.0' });

    const model = await prisma.rLModelVersion.findUnique({
      where: { id: modelId },
      include: { arms: true }
    });

    expect(model).not.toBeNull();
    expect(model?.algorithm).toBe('ThompsonSampling');
    expect(model?.arms.length).toBe(21); // 0-10 in 0.5 increments
  });

  it('should load model state into bandit', async () => {
    const modelId = await store.createModel({ version: 'v1.0.0' });

    // Update some arms
    await prisma.rLBanditArm.updateMany({
      where: { modelId, deltaC: 5.0 },
      data: { alpha: 10, beta: 5, pullCount: 15, successCount: 9 }
    });

    const bandit = await store.loadModel(modelId);
    expect(bandit).not.toBeNull();

    const state = bandit!.getState();
    const bucket = state.buckets.get('5.0');
    expect(bucket?.alpha).toBe(10);
    expect(bucket?.beta).toBe(5);
  });

  it('should save bandit state', async () => {
    const modelId = await store.createModel({ version: 'v1.0.0' });
    const bandit = new ThompsonSamplingBandit();

    // Simulate some updates: 2 successes, 1 failure
    bandit.update('5.0', true);
    bandit.update('5.0', false);
    bandit.update('5.0', true);

    await store.saveModel(modelId, bandit);

    const reloaded = await store.loadModel(modelId);
    const state = reloaded!.getState();
    const bucket = state.buckets.get('5.0');

    expect(bucket?.alpha).toBe(3); // prior 1 + 2 successes
    expect(bucket?.beta).toBe(2); // prior 1 + 1 failure
  });

  it('should log training data', async () => {
    const modelId = await store.createModel({ version: 'v1.0.0' });

    const logId = await store.logTraining(modelId, {
      eventId: 'event1',
      attemptId: 'attempt1',
      userId: 'user1',
      questionId: 'q1',
      knowledgePointId: 'kp1',
      recommendationId: 'rec1',
      preAccuracy: 0.5,
      stateTheta: 0.2,
      selectedDeltaC: 5.0,
      reward: 0.7,
      postAccuracy: 0.6,
      leDelta: 0.1
    });

    const log = await prisma.rLTrainingLog.findUnique({
      where: { id: logId }
    });

    expect(log).not.toBeNull();
    expect(log?.eventId).toBe('event1');
    expect(log?.leDelta).toBe(0.1);
  });
});
