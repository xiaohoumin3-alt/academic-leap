/**
 * Ability Estimator Tests
 */

import { describe, test, expect } from '@jest/globals';
import {
  estimateAbility,
  estimateAllAbilities,
  AbilityEstimate,
  StudentAbilityProfile,
  Answer
} from './ability-estimator';

describe('estimateAbility', () => {
  const nodeId = 'node_1';
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  describe('insufficient data (less than 3 answers)', () => {
    test('returns default ability of 0.5 with zero answers', () => {
      const result = estimateAbility([], nodeId);

      expect(result.nodeId).toBe(nodeId);
      expect(result.ability).toBe(0.5);
      expect(result.sampleSize).toBe(0);
      expect(result.confidence).toBe(0.1);
      expect(result.lastUpdated).toBeCloseTo(Date.now(), -3);
    });

    test('returns default ability with 1 answer', () => {
      const answers: Answer[] = [
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      expect(result.nodeId).toBe(nodeId);
      expect(result.ability).toBe(0.5);
      expect(result.sampleSize).toBe(1);
      expect(result.confidence).toBe(0.1);
    });

    test('returns default ability with 2 answers', () => {
      const answers: Answer[] = [
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      expect(result.nodeId).toBe(nodeId);
      expect(result.ability).toBe(0.5);
      expect(result.sampleSize).toBe(2);
      expect(result.confidence).toBe(0.1);
    });
  });

  describe('calculates ability correctly with enough data', () => {
    test('calculates 100% correct rate', () => {
      const answers: Answer[] = [
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      expect(result.nodeId).toBe(nodeId);
      expect(result.ability).toBe(1.0);
      expect(result.sampleSize).toBe(3);
      expect(result.confidence).toBeCloseTo(0.15, 1);
    });

    test('calculates 0% correct rate', () => {
      const answers: Answer[] = [
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      expect(result.ability).toBe(0.0);
      expect(result.sampleSize).toBe(3);
    });

    test('calculates 50% correct rate', () => {
      const answers: Answer[] = [
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      expect(result.ability).toBe(0.5);
      expect(result.sampleSize).toBe(4);
    });

    test('handles answers from different nodes correctly', () => {
      const answers: Answer[] = [
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now, knowledgeNodes: ['other_node'] },
        { correct: true, timestamp: now, knowledgeNodes: [nodeId, 'other_node'] }
      ];

      const result = estimateAbility(answers, nodeId);

      // 3 answers are for node_1, all with correct=true
      expect(result.sampleSize).toBe(3);
      expect(result.ability).toBe(1.0);
    });
  });

  describe('applies time decay to recent answers', () => {
    test('recent answers have higher weight', () => {
      const answers: Answer[] = [
        // Old wrong answer
        { correct: false, timestamp: now - 60 * dayMs, knowledgeNodes: [nodeId] },
        // Recent correct answers
        { correct: true, timestamp: now - 1 * dayMs, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now - 1 * dayMs, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      // The ability should be close to 1.0 because recent answers dominate
      // due to exponential decay with 30-day half-life
      expect(result.ability).toBeGreaterThan(0.8);
    });

    test('old answers have lower weight', () => {
      const answers: Answer[] = [
        // Old correct answers
        { correct: true, timestamp: now - 60 * dayMs, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now - 60 * dayMs, knowledgeNodes: [nodeId] },
        // Recent wrong answer
        { correct: false, timestamp: now - 1 * dayMs, knowledgeNodes: [nodeId] }
      ];

      const result = estimateAbility(answers, nodeId);

      // The ability should be lower due to recent wrong answer
      // Even though historically 2/3 were correct
      expect(result.ability).toBeLessThan(0.6);
    });

    test('custom decay half-life affects weighting', () => {
      const longHalfLifeAnswers: Answer[] = [
        { correct: true, timestamp: now - 90 * dayMs, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now - 90 * dayMs, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now - 1 * dayMs, knowledgeNodes: [nodeId] }
      ];

      const shortHalfLifeAnswers: Answer[] = [
        { correct: true, timestamp: now - 90 * dayMs, knowledgeNodes: [nodeId] },
        { correct: true, timestamp: now - 90 * dayMs, knowledgeNodes: [nodeId] },
        { correct: false, timestamp: now - 1 * dayMs, knowledgeNodes: [nodeId] }
      ];

      // Short half-life: recent wrong answer dominates
      const shortResult = estimateAbility(shortHalfLifeAnswers, nodeId, {
        decayHalfLifeDays: 7
      });

      // Long half-life: older correct answers have more influence
      const longResult = estimateAbility(longHalfLifeAnswers, nodeId, {
        decayHalfLifeDays: 60
      });

      // With short half-life, ability should be very low
      // With long half-life, ability should be higher
      expect(shortResult.ability).toBeLessThan(longResult.ability);
    });
  });

  describe('confidence calculation', () => {
    test('confidence increases with sample size up to 0.9', () => {
      const baseTime = now - 30 * dayMs;

      // 5 answers = 0.25 confidence
      const fiveAnswers: Answer[] = Array(5).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: baseTime + i * dayMs,
        knowledgeNodes: [nodeId]
      }));

      // 20+ answers = 0.9 confidence (capped)
      const twentyAnswers: Answer[] = Array(20).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: baseTime + i * dayMs,
        knowledgeNodes: [nodeId]
      }));

      const fiveResult = estimateAbility(fiveAnswers, nodeId);
      const twentyResult = estimateAbility(twentyAnswers, nodeId);

      expect(fiveResult.confidence).toBeCloseTo(0.25, 1);
      expect(twentyResult.confidence).toBe(0.9); // Capped at 0.9
    });
  });
});

describe('estimateAllAbilities', () => {
  const now = Date.now();

  test('creates profile for student with no answers', () => {
    const profile = estimateAllAbilities([], 'student_1');

    expect(profile.studentId).toBe('student_1');
    expect(profile.abilities).toEqual([]);
    expect(profile.overallAbility).toBe(0.5);
    expect(profile.totalAnswers).toBe(0);
    expect(profile.recentCorrectRate).toBe(0.5);
  });

  test('creates abilities for all unique nodes', () => {
    const answers: Answer[] = [
      { correct: true, timestamp: now, knowledgeNodes: ['math_1', 'math_2'] },
      { correct: false, timestamp: now, knowledgeNodes: ['math_1'] },
      { correct: true, timestamp: now, knowledgeNodes: ['math_2'] }
    ];

    const profile = estimateAllAbilities(answers, 'student_1');

    expect(profile.abilities.length).toBe(2);

    const math1Ability = profile.abilities.find(a => a.nodeId === 'math_1');
    const math2Ability = profile.abilities.find(a => a.nodeId === 'math_2');

    expect(math1Ability).toBeDefined();
    expect(math2Ability).toBeDefined();
    expect(math1Ability?.sampleSize).toBe(2);
    expect(math2Ability?.sampleSize).toBe(2);
  });

  test('calculates weighted overall ability', () => {
    const answers: Answer[] = [
      { correct: true, timestamp: now, knowledgeNodes: ['weak_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['weak_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['weak_node'] },
      { correct: false, timestamp: now, knowledgeNodes: ['weak_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['strong_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['strong_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['strong_node'] },
      { correct: true, timestamp: now, knowledgeNodes: ['strong_node'] }
    ];

    const profile = estimateAllAbilities(answers, 'student_1');

    // weak_node: 75% correct, strong_node: 100% correct
    // overall should be weighted by confidence
    expect(profile.overallAbility).toBeGreaterThan(0.75);
    expect(profile.overallAbility).toBeLessThan(1.0);
  });

  test('calculates recent correct rate from last 20 answers', () => {
    const answers: Answer[] = Array(25).fill(null).map((_, i) => ({
      correct: i < 5, // First 5 are correct (indices 0-4), rest are wrong (indices 5-24)
      timestamp: now - i * 60 * 1000, // Each 1 minute apart
      knowledgeNodes: ['test_node']
    }));

    const profile = estimateAllAbilities(answers, 'student_1');

    // Last 20 answers: indices 5-24 (all are wrong since i >= 5)
    // So recent correct rate should be 0/20 = 0
    expect(profile.recentCorrectRate).toBe(0);
  });

  test('sets totalAnswers correctly', () => {
    const answers: Answer[] = [
      { correct: true, timestamp: now, knowledgeNodes: ['node_1'] },
      { correct: false, timestamp: now, knowledgeNodes: ['node_2'] },
      { correct: true, timestamp: now, knowledgeNodes: ['node_1'] }
    ];

    const profile = estimateAllAbilities(answers, 'student_1');

    expect(profile.totalAnswers).toBe(3);
  });
});
