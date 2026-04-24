import { describe, it, expect } from '@jest/globals';
import { calculatePriority, generatePriorityReasons } from './priority';
import type { PriorityFactorsInput } from './types';

describe('calculatePriority', () => {
  it('should calculate base priority correctly', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0,
      includeStale: false
    };

    const result = calculatePriority(input);

    // baseScore = 3 * (1 - 0.5) = 1.5
    // failureBonus = 1.0 (no recent failures)
    // stalePenalty = 1.0 (not stale)
    // total = 1.5 * 1.0 * 1.0 = 1.5
    expect(result.score).toBe(1.5);
    expect(result.breakdown.baseScore).toBe(1.5);
    expect(result.breakdown.failureBonus).toBe(1.0);
    expect(result.breakdown.stalePenalty).toBe(1.0);
  });

  it('should apply failure bonus for high recent failure rate', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0.6, // > 0.5
      includeStale: false
    };

    const result = calculatePriority(input);

    // baseScore = 1.5, failureBonus = 1.5
    expect(result.score).toBe(2.25);
    expect(result.breakdown.failureBonus).toBe(1.5);
  });

  it('should apply stale penalty when not including stale and days > 14', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 15,
      recentFailureRate: 0,
      includeStale: false // 用户不包含stale
    };

    const result = calculatePriority(input);

    // baseScore = 3 * (1 - 0.8) = 0.6
    // stalePenalty = 0.5 (stale且不包含)
    expect(result.breakdown.stalePenalty).toBe(0.5);
  });

  it('should not apply stale penalty when includeStale is true', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 15,
      recentFailureRate: 0,
      includeStale: true // 用户选择包含stale
    };

    const result = calculatePriority(input);

    // stalePenalty = 1 (用户选择包含)
    expect(result.breakdown.stalePenalty).toBe(1.0);
  });

  it('should return zero priority for fully mastered with no issues', () => {
    const input: PriorityFactorsInput = {
      mastery: 1.0,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0,
      includeStale: false
    };

    const result = calculatePriority(input);

    expect(result.score).toBe(0);
  });
});

describe('generatePriorityReasons', () => {
  it('should generate reasons for high weight weak knowledge', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.2,
      weight: 5,
      daysSincePractice: 2,
      recentFailureRate: 0.6,
      includeStale: false
    });

    expect(reasons).toContain('权重高(5)');
    expect(reasons).toContain('测评正确率低');
    expect(reasons).toContain('最近错误率高');
  });

  it('should generate stale reason', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 16,
      recentFailureRate: 0,
      includeStale: false
    });

    expect(reasons).toContain('久未练习(16天)');
  });

  it('should return minimal reasons for average knowledge', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0.3,
      includeStale: false
    });

    expect(reasons.length).toBeGreaterThan(0);
  });
});
