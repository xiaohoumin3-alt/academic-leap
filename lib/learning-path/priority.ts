import { prisma } from '@/lib/prisma';
import type { PriorityFactorsInput, PriorityResult } from './types';

const STALE_DAYS_THRESHOLD = 14;
const HIGH_FAILURE_RATE_THRESHOLD = 0.5;
const FAILURE_BONUS_MULTIPLIER = 1.5;
const STALE_PENALTY_MULTIPLIER = 0.5;

export function calculatePriority(input: PriorityFactorsInput): PriorityResult {
  const { mastery, weight, daysSincePractice, recentFailureRate, includeStale } = input;

  const baseScore = weight * (1 - mastery);

  const failureBonus = recentFailureRate > HIGH_FAILURE_RATE_THRESHOLD
    ? FAILURE_BONUS_MULTIPLIER
    : 1.0;

  let stalePenalty = 1.0;
  if (!includeStale && daysSincePractice > STALE_DAYS_THRESHOLD) {
    stalePenalty = STALE_PENALTY_MULTIPLIER;
  }

  const score = baseScore * failureBonus * stalePenalty;

  return {
    score: Math.max(0, score),
    breakdown: {
      baseScore,
      failureBonus,
      stalePenalty
    }
  };
}

export function generatePriorityReasons(input: PriorityFactorsInput): string[] {
  const reasons: string[] = [];
  const { mastery, weight, daysSincePractice, recentFailureRate } = input;

  if (weight >= 4) {
    reasons.push(`权重高(${weight})`);
  } else if (weight <= 2) {
    reasons.push(`权重低(${weight})`);
  }

  if (mastery < 0.3) {
    reasons.push('测评正确率低');
  } else if (mastery > 0.8) {
    reasons.push('基本掌握');
  }

  if (recentFailureRate > HIGH_FAILURE_RATE_THRESHOLD) {
    reasons.push('最近错误率高');
  }

  if (daysSincePractice > STALE_DAYS_THRESHOLD) {
    reasons.push(`久未练习(${daysSincePractice}天)`);
  }

  return reasons.length > 0 ? reasons : ['常规学习'];
}

export async function getUserMastery(userId: string, knowledgePointId: string): Promise<number> {
  const userKnowledge = await prisma.userKnowledge.findUnique({
    where: {
      userId_knowledgePoint: {
        userId,
        knowledgePoint: knowledgePointId
      }
    }
  });

  if (userKnowledge) {
    return userKnowledge.mastery;
  }

  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: 1
  });

  if (latestAssessment) {
    try {
      const knowledgeData = JSON.parse(latestAssessment.knowledgeData as string);
      const kpData = knowledgeData[knowledgePointId];
      if (kpData && kpData.mastery !== undefined) {
        return kpData.mastery;
      }
    } catch {
      // 解析失败，返回默认值
    }
  }

  return 0;
}

export async function getDaysSincePractice(userId: string, knowledgePointId: string): Promise<number> {
  const userKnowledge = await prisma.userKnowledge.findUnique({
    where: {
      userId_knowledgePoint: {
        userId,
        knowledgePoint: knowledgePointId
      }
    }
  });

  if (!userKnowledge) {
    return 999;
  }

  const now = new Date();
  const lastPractice = new Date(userKnowledge.lastPractice);
  const diffMs = now.getTime() - lastPractice.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export async function getRecentFailureRate(
  userId: string,
  knowledgePointId: string,
  days: number
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recentSteps = await prisma.attemptStep.findMany({
    where: {
      attempt: {
        userId
      }
    },
    include: {
      attempt: {
        include: {
          questionStep: {
            include: {
              question: true
            }
          }
        }
      }
    }
  });

  let relevantCount = 0;
  let failureCount = 0;

  for (const step of recentSteps) {
    if (step.submittedAt < since) continue;

    try {
      if (step.attempt?.questionStep) {
        const question = step.attempt.questionStep.question;
        if (question) {
          const knowledgePoints = JSON.parse(question.knowledgePoints || '[]');
          if (knowledgePoints.includes(knowledgePointId)) {
            relevantCount++;
            if (!step.isCorrect) {
              failureCount++;
            }
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }

  if (relevantCount === 0) {
    return 0;
  }

  return failureCount / relevantCount;
}
