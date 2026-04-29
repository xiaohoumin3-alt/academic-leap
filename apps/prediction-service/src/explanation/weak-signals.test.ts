/**
 * Weak Signals Tests
 */

import { describe, test, expect } from 'vitest';
import {
  computeWeakSignals,
  hasTimeData,
  computeTimeCorrectnessCorrelation,
  computeNodePerformanceCorrelation,
  WeakSignalsResult,
  WeakCausalSignal
} from './weak-signals';

describe('computeWeakSignals', () => {
  describe('generates signals with required caveats', () => {
    test('every signal must have non-causality caveat', () => {
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 30 + i * 5
      }));

      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.75, sampleSize: 10 }]
      ]);

      const result = computeWeakSignals(answers, abilities);

      for (const signal of result.signals) {
        expect(signal.caveat).toContain('不承诺因果');
      }
    });

    test('correlation type signal includes non-causality disclaimer', () => {
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 30 + i * 5
      }));

      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.75, sampleSize: 10 }]
      ]);

      const result = computeWeakSignals(answers, abilities);

      const correlationSignal = result.signals.find(s => s.type === 'correlation');
      expect(correlationSignal).toBeDefined();
      expect(correlationSignal?.caveat).toBe('仅显示相关性，不承诺因果关系');
    });
  });

  describe('handles empty data gracefully', () => {
    test('returns empty signals for empty answers', () => {
      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.8, sampleSize: 10 }]
      ]);

      const result = computeWeakSignals([], abilities);

      expect(result.signals).toEqual([]);
      expect(result.interventionCorrelations.length).toBeGreaterThan(0);
    });

    test('returns correct signal count when no abilities', () => {
      // Has time data -> generates time correlation signal
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 30 + i * 5
      }));

      const result = computeWeakSignals(answers, new Map());

      // Time correlation signal exists
      expect(result.signals.length).toBe(1);
      // But no intervention correlations (no abilities)
      expect(result.interventionCorrelations).toEqual([]);
    });

    test('returns empty signals for completely empty data', () => {
      const result = computeWeakSignals([], new Map());

      expect(result.signals).toEqual([]);
      expect(result.interventionCorrelations).toEqual([]);
      expect(result.generatedAt).toBeDefined();
    });

    test('result includes generatedAt timestamp', () => {
      const before = Date.now();
      const result = computeWeakSignals([], new Map());
      const after = Date.now();

      expect(result.generatedAt).toBeGreaterThanOrEqual(before);
      expect(result.generatedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('computes correlations when enough time data exists', () => {
    test('returns null correlation when less than 10 time samples', () => {
      const answers = [
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 30 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 45 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 60 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 40 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 55 }
      ];

      const result = computeWeakSignals(answers, new Map());

      // Should not have time correlation signal (not enough samples)
      const timeSignal = result.signals.find(s => s.description === '答题时间与正确率的相关性');
      expect(timeSignal).toBeUndefined();
    });

    test('computes correlation when 10+ time samples exist', () => {
      // Create answers where longer time = more likely to be correct
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i > 7, // First 8 wrong, last 7 correct
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 20 + i * 10 // Time increases with index
      }));

      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.6, sampleSize: 15 }]
      ]);

      const result = computeWeakSignals(answers, abilities);

      const timeSignal = result.signals.find(s => s.description === '答题时间与正确率的相关性');
      expect(timeSignal).toBeDefined();
      expect(timeSignal?.sampleSize).toBe(15);
      expect(timeSignal?.value).toBeGreaterThan(0); // Positive correlation expected
    });

    test('handles answers without time data', () => {
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1']
        // No timeSpent field
      }));

      const result = computeWeakSignals(answers, new Map());

      expect(result.signals).toEqual([]);
    });

    test('treats zero time as valid data in correlation calculation', () => {
      // Note: hasTimeData requires timeSpent > 0, but once triggered,
      // computeTimeCorrectnessCorrelation includes all samples with timeSpent
      const answers = [
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 0 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 0 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 30 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 45 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 60 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 75 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 90 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 105 },
        { correct: true, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 120 },
        { correct: false, timestamp: Date.now(), knowledgeNodes: ['test'], timeSpent: 135 }
      ];

      const result = computeWeakSignals(answers, new Map());

      const timeSignal = result.signals.find(s => s.description === '答题时间与正确率的相关性');
      expect(timeSignal).toBeDefined();
      // All 10 samples included (zeros still count for correlation calculation)
      expect(timeSignal?.sampleSize).toBe(10);
    });
  });

  describe('requires minimum sample size for intervention correlations', () => {
    test('only includes nodes with 5+ sample size', () => {
      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.9, sampleSize: 10 }],  // Include
        ['node_2', { ability: 0.7, sampleSize: 5 }],   // Include (exactly 5)
        ['node_3', { ability: 0.5, sampleSize: 4 }],    // Exclude
        ['node_4', { ability: 0.3, sampleSize: 1 }]     // Exclude
      ]);

      const result = computeWeakSignals([], abilities);

      expect(result.interventionCorrelations.length).toBe(2);
      const nodeIds = result.interventionCorrelations.map(c => c.action.replace('掌握知识点 ', ''));
      expect(nodeIds).toContain('node_1');
      expect(nodeIds).toContain('node_2');
      expect(nodeIds).not.toContain('node_3');
      expect(nodeIds).not.toContain('node_4');
    });

    test('includes exact threshold (sampleSize >= 5)', () => {
      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['exactly_5', { ability: 0.8, sampleSize: 5 }]  // Should be included
      ]);

      const result = computeWeakSignals([], abilities);

      expect(result.interventionCorrelations.length).toBe(1);
      expect(result.interventionCorrelations[0].action).toContain('exactly_5');
    });

    test('excludes nodes with sampleSize < 5', () => {
      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['below_threshold', { ability: 0.9, sampleSize: 4 }]  // Should be excluded
      ]);

      const result = computeWeakSignals([], abilities);

      expect(result.interventionCorrelations.length).toBe(0);
    });
  });

  describe('signal structure validation', () => {
    test('signal has correct type field', () => {
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 30 + i * 5
      }));

      const result = computeWeakSignals(answers, new Map());

      if (result.signals.length > 0) {
        expect(['correlation', 'conditional_independence']).toContain(result.signals[0].type);
      }
    });

    test('signal has all required fields', () => {
      const answers = Array(15).fill(null).map((_, i) => ({
        correct: i % 2 === 0,
        timestamp: Date.now(),
        knowledgeNodes: ['node_1'],
        timeSpent: 30 + i * 5
      }));

      const abilities = new Map<string, { ability: number; sampleSize: number }>([
        ['node_1', { ability: 0.8, sampleSize: 10 }]
      ]);

      const result = computeWeakSignals(answers, abilities);

      // Check all signals have required fields
      for (const signal of result.signals) {
        expect(signal).toHaveProperty('type');
        expect(signal).toHaveProperty('description');
        expect(signal).toHaveProperty('value');
        expect(signal).toHaveProperty('sampleSize');
        expect(signal).toHaveProperty('caveat');
      }

      // Check all intervention correlations have required fields
      for (const corr of result.interventionCorrelations) {
        expect(corr).toHaveProperty('action');
        expect(corr).toHaveProperty('outcome');
        expect(corr).toHaveProperty('correlation');
        expect(corr).toHaveProperty('sampleSize');
      }
    });
  });
});

describe('hasTimeData', () => {
  test('returns true when answers have time data', () => {
    const answers = [
      { correct: true, timeSpent: 30 },
      { correct: false, timeSpent: 45 }
    ];

    expect(hasTimeData(answers)).toBe(true);
  });

  test('returns false when answers have no time data', () => {
    const answers = [
      { timeSpent: undefined },
      { timeSpent: undefined }
    ];

    expect(hasTimeData(answers)).toBe(false);
  });

  test('returns false when all timeSpent is 0 or undefined', () => {
    const answers = [
      { correct: true, timeSpent: 0 },
      { correct: false, timeSpent: undefined as unknown as number }
    ];

    expect(hasTimeData(answers)).toBe(false);
  });

  test('returns true if at least one answer has valid time data', () => {
    const answers = [
      { correct: true, timeSpent: 0 },  // Invalid
      { correct: false, timeSpent: 30 } // Valid
    ];

    expect(hasTimeData(answers)).toBe(true);
  });
});

describe('computeTimeCorrectnessCorrelation', () => {
  test('returns null for less than 10 samples', () => {
    const answers = [
      { correct: true, timeSpent: 30 },
      { correct: false, timeSpent: 45 }
    ];

    expect(computeTimeCorrectnessCorrelation(answers)).toBeNull();
  });

  test('computes positive correlation when longer time = more correct', () => {
    // Perfect positive correlation: correct when time > 50
    const answers = [
      { correct: false, timeSpent: 30 },
      { correct: false, timeSpent: 40 },
      { correct: false, timeSpent: 45 },
      { correct: true, timeSpent: 50 },
      { correct: true, timeSpent: 55 },
      { correct: true, timeSpent: 60 },
      { correct: true, timeSpent: 65 },
      { correct: true, timeSpent: 70 },
      { correct: true, timeSpent: 75 },
      { correct: true, timeSpent: 80 }
    ];

    const correlation = computeTimeCorrectnessCorrelation(answers);

    expect(correlation).not.toBeNull();
    expect(correlation!).toBeGreaterThan(0.7); // Strong positive correlation
  });

  test('computes negative correlation when longer time = more wrong', () => {
    // Perfect negative correlation: correct when time < 50
    const answers = [
      { correct: true, timeSpent: 30 },
      { correct: true, timeSpent: 40 },
      { correct: true, timeSpent: 45 },
      { correct: false, timeSpent: 50 },
      { correct: false, timeSpent: 55 },
      { correct: false, timeSpent: 60 },
      { correct: false, timeSpent: 65 },
      { correct: false, timeSpent: 70 },
      { correct: false, timeSpent: 75 },
      { correct: false, timeSpent: 80 }
    ];

    const correlation = computeTimeCorrectnessCorrelation(answers);

    expect(correlation).not.toBeNull();
    expect(correlation!).toBeLessThan(-0.7); // Strong negative correlation
  });

  test('returns 0 for zero variance in either variable', () => {
    // All same time - denominator would be 0
    const answers = [
      { correct: true, timeSpent: 50 },
      { correct: true, timeSpent: 50 },
      { correct: true, timeSpent: 50 },
      { correct: false, timeSpent: 50 },
      { correct: false, timeSpent: 50 },
      { correct: true, timeSpent: 50 },
      { correct: false, timeSpent: 50 },
      { correct: true, timeSpent: 50 },
      { correct: false, timeSpent: 50 },
      { correct: true, timeSpent: 50 }
    ];

    const correlation = computeTimeCorrectnessCorrelation(answers);

    expect(correlation).toBe(0); // Returns 0 instead of NaN
  });

  test('handles mixed correct/incorrect patterns', () => {
    const answers = [
      { correct: true, timeSpent: 30 },
      { correct: false, timeSpent: 35 },
      { correct: true, timeSpent: 40 },
      { correct: false, timeSpent: 45 },
      { correct: true, timeSpent: 50 },
      { correct: false, timeSpent: 55 },
      { correct: true, timeSpent: 60 },
      { correct: false, timeSpent: 65 },
      { correct: true, timeSpent: 70 },
      { correct: false, timeSpent: 75 }
    ];

    const correlation = computeTimeCorrectnessCorrelation(answers);

    // No correlation expected (alternating pattern)
    expect(correlation).not.toBeNull();
    expect(Math.abs(correlation!)).toBeLessThan(0.5);
  });
});

describe('computeNodePerformanceCorrelation', () => {
  test('returns empty array for empty map', () => {
    const result = computeNodePerformanceCorrelation(new Map());
    expect(result).toEqual([]);
  });

  test('filters out nodes below sample size threshold', () => {
    const abilities = new Map<string, { ability: number; sampleSize: number }>([
      ['low_sample', { ability: 0.9, sampleSize: 3 }],
      ['exact_threshold', { ability: 0.8, sampleSize: 5 }],
      ['high_sample', { ability: 0.7, sampleSize: 20 }]
    ]);

    const result = computeNodePerformanceCorrelation(abilities);

    expect(result.length).toBe(2);
    const nodeIds = result.map(c => c.action.replace('掌握知识点 ', ''));
    expect(nodeIds).toContain('exact_threshold');
    expect(nodeIds).toContain('high_sample');
    expect(nodeIds).not.toContain('low_sample');
  });

  test('creates correct intervention correlation structure', () => {
    const abilities = new Map<string, { ability: number; sampleSize: number }>([
      ['derivative_rules', { ability: 0.85, sampleSize: 12 }]
    ]);

    const result = computeNodePerformanceCorrelation(abilities);

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      action: '掌握知识点 derivative_rules',
      outcome: 'derivative_rules 相关题目正确率',
      correlation: 0.85,
      sampleSize: 12
    });
  });

  test('handles multiple nodes correctly', () => {
    const abilities = new Map<string, { ability: number; sampleSize: number }>([
      ['node_a', { ability: 0.9, sampleSize: 10 }],
      ['node_b', { ability: 0.6, sampleSize: 8 }],
      ['node_c', { ability: 0.3, sampleSize: 15 }]
    ]);

    const result = computeNodePerformanceCorrelation(abilities);

    expect(result.length).toBe(3);
    expect(result.map(r => r.correlation)).toContain(0.9);
    expect(result.map(r => r.correlation)).toContain(0.6);
    expect(result.map(r => r.correlation)).toContain(0.3);
  });
});
