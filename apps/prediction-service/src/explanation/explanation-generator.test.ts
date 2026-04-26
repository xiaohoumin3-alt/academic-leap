/**
 * Explanation Generator Tests
 *
 * Tests use IRT ability scale [-2, 2]
 * Helper: IRT_to_Prob = 1 / (1 + exp(-IRT))
 * Helper: Prob_to_IRT = (Prob - 0.5) * 4
 */

import { describe, test, expect } from 'vitest';
import {
  generateExplanation,
  generatePrimaryReason,
  generateSupportingFactors,
  Explanation,
  GenerateExplanationInput
} from './explanation-generator';

// Convert probability [0,1] to IRT scale [-2,2]
function toIRT(prob: number): number {
  return (prob - 0.5) * 4;
}

describe('generatePrimaryReason', () => {
  test('returns high probability explanation when ability > difficulty + 0.2', () => {
    // ability in IRT = 1.2 → prob ≈ 0.77, difficulty = 0.5
    // abilityProb = 0.77 > 0.5 + 0.2 = 0.7 ✓
    const result = generatePrimaryReason(0.75, toIRT(0.8), 0.5);

    expect(result).toContain('学生能力');
    expect(result).toContain('高于题目难度');
    expect(result).toContain('预测正确概率较高');
  });

  test('returns default high probability explanation when ability is not much higher', () => {
    // ability in IRT = 0.4 → prob ≈ 0.60, difficulty = 0.5
    // abilityProb = 0.60 < 0.5 + 0.2 = 0.7 ✗
    const result = generatePrimaryReason(0.75, toIRT(0.6), 0.5);

    expect(result).toContain('基于历史表现');
    expect(result).toContain('预测该生在此类题目上有较好的正确率');
  });

  test('returns low probability explanation when ability < difficulty - 0.1', () => {
    // ability in IRT = -0.4 → prob ≈ 0.40, difficulty = 0.6
    // abilityProb = 0.40 < 0.6 - 0.1 = 0.5 ✓
    const result = generatePrimaryReason(0.3, toIRT(0.4), 0.6);

    expect(result).toContain('学生能力');
    expect(result).toContain('低于题目难度');
    expect(result).toContain('预测正确概率较低');
  });

  test('returns default low probability explanation when ability is close to difficulty', () => {
    // ability in IRT = 0.4 → prob ≈ 0.60, difficulty = 0.6
    // abilityProb = 0.60 > 0.6 - 0.1 = 0.5 ✗
    const result = generatePrimaryReason(0.3, toIRT(0.6), 0.6);

    expect(result).toContain('历史数据显示该生在此难度区间正确率不高');
  });

  test('returns borderline explanation when probability is near 0.5', () => {
    const result = generatePrimaryReason(0.5, toIRT(0.5), 0.5);

    expect(result).toContain('预测结果接近临界');
    expect(result).toContain('需要更多数据');
  });
});

describe('generateSupportingFactors', () => {
  test('includes sample size in factors', () => {
    const profile = {
      overallAbility: toIRT(0.7),
      abilities: [],
      totalAnswers: 50,
      recentCorrectRate: 0.6
    };
    const questionFeatures = { knowledgeNodes: ['node_1'] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('50') && f.includes('历史数据'))).toBe(true);
  });

  test('reports rising trend when recent correct rate > 0.6', () => {
    const profile = {
      overallAbility: toIRT(0.7),
      abilities: [],
      totalAnswers: 20,
      recentCorrectRate: 0.7
    };
    const questionFeatures = { knowledgeNodes: [] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('上升'))).toBe(true);
  });

  test('includes relevant knowledge node ability', () => {
    const profile = {
      overallAbility: toIRT(0.7),
      abilities: [
        { nodeId: 'node_1', ability: toIRT(0.8), confidence: 0.8 },
        { nodeId: 'node_2', ability: toIRT(0.6), confidence: 0.6 }
      ],
      totalAnswers: 30,
      recentCorrectRate: 0.65
    };
    const questionFeatures = { knowledgeNodes: ['node_1', 'node_2'] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    const relevantFactor = factors.find(f => f.includes('相关知识点'));
    expect(relevantFactor).toBeDefined();
    // Average of toIRT(0.8)=1.2 and toIRT(0.6)=0.4 = 0.8
    // 0.8 in IRT → prob = 1/(1+exp(-0.8)) ≈ 0.69 → 69%
    expect(relevantFactor).toContain('69%');
  });

  test('does not include relevant ability factor when no relevant nodes found', () => {
    const profile = {
      overallAbility: toIRT(0.7),
      abilities: [
        { nodeId: 'node_1', ability: toIRT(0.85), confidence: 0.8 }
      ],
      totalAnswers: 30,
      recentCorrectRate: 0.6
    };
    const questionFeatures = { knowledgeNodes: ['node_999'] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('相关知识点'))).toBe(false);
  });
});

describe('generateExplanation', () => {
  // Input with IRT scale abilities
  const baseInput: GenerateExplanationInput = {
    predictionProbability: 0.75,
    predictionConfidence: 0.85,
    studentAbility: toIRT(0.75),  // ~0.73 probability
    studentAbilityProfile: {
      overallAbility: toIRT(0.75),
      abilities: [
        { nodeId: 'math_1', ability: toIRT(0.8), confidence: 0.75 },
        { nodeId: 'math_2', ability: toIRT(0.65), confidence: 0.6 }
      ],
      totalAnswers: 50,
      recentCorrectRate: 0.68
    },
    questionFeatures: {
      difficulty: 0.5,
      knowledgeNodes: ['math_1', 'math_2']
    }
  };

  test('generates explanation with all required fields', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.primaryReason).toBeDefined();
    expect(explanation.supportingFactors).toBeDefined();
    expect(explanation.supportingFactors.length).toBeGreaterThan(0);
    expect(explanation.confidence).toBeDefined();
    expect(explanation.confidence).toBeGreaterThan(0);
    expect(explanation.confidence).toBeLessThanOrEqual(1);
    expect(explanation.caveats).toBeDefined();
    expect(explanation.caveats.length).toBeGreaterThanOrEqual(3);
    expect(explanation.metadata).toBeDefined();
  });

  test('includes non-causality disclaimer', () => {
    const explanation = generateExplanation(baseInput);

    const hasCausalityDisclaimer = explanation.caveats.some(
      c => c.includes('不构成因果结论')
    );
    expect(hasCausalityDisclaimer).toBe(true);
  });

  test('primary reason reflects high probability case', () => {
    const highAbilityInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbility: toIRT(0.85), // ability > difficulty + 0.2 (0.5 + 0.2 = 0.7)
      questionFeatures: { difficulty: 0.5, knowledgeNodes: ['math_1'] }
    };
    const explanation = generateExplanation(highAbilityInput);

    expect(explanation.primaryReason).toContain('预测正确概率较高');
  });

  test('supporting factors contain sample size', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.supportingFactors.some(f => f.includes('50') && f.includes('历史数据'))).toBe(true);
  });

  test('supporting factors contain relevant knowledge node info', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.supportingFactors.some(f => f.includes('相关知识点'))).toBe(true);
  });

  test('handles low probability case', () => {
    const lowProbInput: GenerateExplanationInput = {
      ...baseInput,
      predictionProbability: 0.25,
      studentAbility: toIRT(0.3),
      questionFeatures: { difficulty: 0.7, knowledgeNodes: ['math_1'] }
    };

    const explanation = generateExplanation(lowProbInput);

    expect(explanation.primaryReason).toContain('预测正确概率较低');
    // confidence = predictionConfidence * normalizedAbility
    // normalizedAbility = |IRT / 2| = |toIRT(0.3) / 2| = |-0.8 / 2| = 0.4
    // confidence = 0.85 * 0.4 = 0.34
    expect(explanation.confidence).toBeCloseTo(0.85 * 0.4, 2);
  });

  test('handles borderline probability case', () => {
    const borderInput: GenerateExplanationInput = {
      ...baseInput,
      predictionProbability: 0.5
    };

    const explanation = generateExplanation(borderInput);

    expect(explanation.primaryReason).toContain('预测结果接近临界');
    expect(explanation.primaryReason).toContain('需要更多数据');
  });

  test('confidence is normalized to [0, 1]', () => {
    const extremeAbilityInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbility: toIRT(0.95),  // Very high ability
      predictionConfidence: 0.9
    };

    const explanation = generateExplanation(extremeAbilityInput);

    // normalizedAbility = |toIRT(0.95) / 2| = |1.8 / 2| = 0.9
    // confidence = 0.9 * 0.9 = 0.81
    expect(explanation.confidence).toBeLessThanOrEqual(1);
    expect(explanation.confidence).toBeGreaterThan(0);
  });

  test('handles very low ability in IRT scale', () => {
    const lowAbilityInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbility: toIRT(0.1),  // Low ability
      predictionConfidence: 0.8
    };

    const explanation = generateExplanation(lowAbilityInput);

    // normalizedAbility = |toIRT(0.1) / 2| = |-1.6 / 2| = 0.8
    // confidence = 0.8 * 0.8 = 0.64
    expect(explanation.confidence).toBeCloseTo(0.8 * 0.8, 2);
  });
});
