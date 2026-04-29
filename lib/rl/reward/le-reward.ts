// lib/rl/reward/le-reward.ts

import type { LEHistoryService } from '../history/le-history-service';

export interface StudentResponse {
  userId: string;
  questionId: string;
  correct: boolean;
  knowledgePointId: string;
  eventId: string;
  attemptId: string;
}

export interface LETrackingContext {
  knowledgePointId: string;
  preAccuracy: number;
  recommendationId: string;
}

export interface RewardResult {
  reward: number;
  preAccuracy: number;
  postAccuracy: number;
  leDelta: number;
}

// Sigmoid function for mapping improvement to reward
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-5 * x));
}

// LE-aligned reward: measures learning improvement
export async function calculateLEReward(
  response: StudentResponse,
  context: LETrackingContext,
  historyService: LEHistoryService
): Promise<RewardResult> {
  const preAccuracy = context.preAccuracy;

  // Update accuracy with new response
  const postAccuracy = await historyService.updateAccuracy(
    response.userId,
    response.knowledgePointId,
    response.correct
  );

  // LE = improvement in accuracy
  const leDelta = postAccuracy - preAccuracy;

  // Reward = sigmoid(improvement)
  // improvement > 0 → reward > 0.5
  // improvement < 0 → reward < 0.5
  const reward = sigmoid(leDelta);

  return {
    reward,
    preAccuracy,
    postAccuracy,
    leDelta
  };
}

// Hybrid reward: combines accuracy target with LE
export async function calculateHybridReward(
  response: StudentResponse,
  context: LETrackingContext,
  historyService: LEHistoryService,
  leWeight: number = 0.7
): Promise<RewardResult> {
  // Component 1: Accuracy reward (target = 0.7)
  const y = response.correct ? 1 : 0;
  const accuracyReward = 1 - Math.abs(y - 0.7);

  // Component 2: LE reward
  const leResult = await calculateLEReward(response, context, historyService);
  const leReward = leResult.reward;

  // Weighted combination
  const reward = (1 - leWeight) * accuracyReward + leWeight * leReward;

  return {
    ...leResult,
    reward
  };
}
