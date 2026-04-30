/**
 * Critical Hit System - 安全随机数版本
 *
 * 使用 crypto.randomBytes 确保暴击判定不可预测
 */

import { randomBytes } from 'crypto';

export interface CriticalHitResult {
  isCritical: boolean;
  multiplier: number;
  animation: 'normal' | 'rare' | 'epic' | 'legendary';
}

// 暴击概率配置（难度越高，暴击率越低）
const CRIT_RATES = {
  easy: 0.05,     // 简单题: 5%
  medium: 0.02,   // 中等题: 2%
  hard: 0.01,     // 困难题: 1%
};

const MULTIPLIERS = {
  normal: 1,
  rare: 1.5,
  epic: 2,
  legendary: 3,
};

/**
 * 使用crypto安全随机数掷暴击
 */
export function rollCriticalHit(difficulty: number): CriticalHitResult {
  // 确定难度等级
  const difficultyLevel =
    difficulty <= 3 ? 'easy' :
    difficulty <= 6 ? 'medium' : 'hard';

  const critRate = CRIT_RATES[difficultyLevel];

  // 使用 crypto.randomBytes 生成安全随机数 [0, 1)
  const randomValue = randomBytes(4).readUInt32LE() / 0xFFFFFFFF;

  // 传说暴击：10%概率触发传说
  if (randomValue < critRate * 0.1) {
    return {
      isCritical: true,
      multiplier: MULTIPLIERS.legendary,
      animation: 'legendary',
    };
  }

  // 史诗暴击
  if (randomValue < critRate * 0.3) {
    return {
      isCritical: true,
      multiplier: MULTIPLIERS.epic,
      animation: 'epic',
    };
  }

  // 稀有暴击
  if (randomValue < critRate) {
    return {
      isCritical: true,
      multiplier: MULTIPLIERS.rare,
      animation: 'rare',
    };
  }

  return {
    isCritical: false,
    multiplier: MULTIPLIERS.normal,
    animation: 'normal',
  };
}

/**
 * 计算暴击加成积分
 */
export function calculateCriticalPoints(basePoints: number, crit: CriticalHitResult): number {
  return Math.floor(basePoints * crit.multiplier);
}
