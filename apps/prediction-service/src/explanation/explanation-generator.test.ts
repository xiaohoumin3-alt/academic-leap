/**
 * Explanation Generator Tests
 */

import { describe, test, expect } from 'vitest';
import {
  generateExplanation,
  generatePrimaryReason,
  generateSupportingFactors,
  Explanation,
  GenerateExplanationInput
} from './explanation-generator';

describe('generatePrimaryReason', () => {
  test('returns high probability explanation when ability > difficulty + 0.2', () => {
    const result = generatePrimaryReason(0.75, 0.8, 0.5);

    expect(result).toContain('学生能力');
    expect(result).toContain('高于题目难度');
    expect(result).toContain('预测正确概率较高');
  });

  test('returns default high probability explanation when ability is not much higher', () => {
    const result = generatePrimaryReason(0.75, 0.6, 0.5);

    expect(result).toContain('基于历史表现');
    expect(result).toContain('预测该生在此类题目上有较好的正确率');
  });

  test('returns low probability explanation when ability < difficulty - 0.1', () => {
    const result = generatePrimaryReason(0.3, 0.4, 0.6);

    expect(result).toContain('学生能力');
    expect(result).toContain('低于题目难度');
    expect(result).toContain('预测正确概率较低');
  });

  test('returns default low probability explanation when ability is close to difficulty', () => {
    const result = generatePrimaryReason(0.3, 0.5, 0.6);

    expect(result).toContain('历史数据显示该生在此难度区间正确率不高');
  });

  test('returns borderline explanation when probability is near 0.5', () => {
    const result = generatePrimaryReason(0.5, 0.5, 0.5);

    expect(result).toContain('预测结果接近临界');
    expect(result).toContain('需要更多数据');
  });
});

describe('generateSupportingFactors', () => {
  test('includes sample size in factors', () => {
    const profile = {
      overallAbility: 0.7,
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
      overallAbility: 0.7,
      abilities: [],
      totalAnswers: 20,
      recentCorrectRate: 0.7
    };
    const questionFeatures = { knowledgeNodes: [] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('上升'))).toBe(true);
  });

  test('reports declining trend when recent correct rate < 0.4', () => {
    const profile = {
      overallAbility: 0.7,
      abilities: [],
      totalAnswers: 20,
      recentCorrectRate: 0.3
    };
    const questionFeatures = { knowledgeNodes: [] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('下降'))).toBe(true);
  });

  test('reports stable trend when recent correct rate is between 0.4 and 0.6', () => {
    const profile = {
      overallAbility: 0.7,
      abilities: [],
      totalAnswers: 20,
      recentCorrectRate: 0.5
    };
    const questionFeatures = { knowledgeNodes: [] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    expect(factors.some(f => f.includes('平稳'))).toBe(true);
  });

  test('includes relevant knowledge node ability when available', () => {
    const profile = {
      overallAbility: 0.7,
      abilities: [
        { nodeId: 'node_1', ability: 0.85, confidence: 0.8 },
        { nodeId: 'node_2', ability: 0.65, confidence: 0.7 }
      ],
      totalAnswers: 30,
      recentCorrectRate: 0.6
    };
    const questionFeatures = { knowledgeNodes: ['node_1'] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    const relevantFactor = factors.find(f => f.includes('相关知识点'));
    expect(relevantFactor).toBeDefined();
    expect(relevantFactor).toContain('85%');
  });

  test('calculates average ability for multiple relevant nodes', () => {
    const profile = {
      overallAbility: 0.7,
      abilities: [
        { nodeId: 'node_1', ability: 0.8, confidence: 0.8 },
        { nodeId: 'node_2', ability: 0.6, confidence: 0.7 }
      ],
      totalAnswers: 30,
      recentCorrectRate: 0.6
    };
    const questionFeatures = { knowledgeNodes: ['node_1', 'node_2'] };

    const factors = generateSupportingFactors(profile, questionFeatures);

    const relevantFactor = factors.find(f => f.includes('相关知识点'));
    expect(relevantFactor).toBeDefined();
    // Average of 0.8 and 0.6 is 0.7, which is 70%
    expect(relevantFactor).toContain('70%');
  });

  test('does not include relevant ability factor when no relevant nodes found', () => {
    const profile = {
      overallAbility: 0.7,
      abilities: [
        { nodeId: 'node_1', ability: 0.85, confidence: 0.8 }
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
  const baseInput: GenerateExplanationInput = {
    predictionProbability: 0.75,
    predictionConfidence: 0.85,
    studentAbility: 0.7,
    studentAbilityProfile: {
      overallAbility: 0.72,
      abilities: [
        { nodeId: 'math_1', ability: 0.8, confidence: 0.75 },
        { nodeId: 'math_2', ability: 0.65, confidence: 0.6 }
      ],
      totalAnswers: 50,
      recentCorrectRate: 0.68
    },
    questionFeatures: {
      difficulty: 0.5,
      knowledgeNodes: ['math_1']
    }
  };

  test('generates explanation with all required fields', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation).toHaveProperty('primaryReason');
    expect(explanation).toHaveProperty('supportingFactors');
    expect(explanation).toHaveProperty('confidence');
    expect(explanation).toHaveProperty('caveats');
    expect(explanation).toHaveProperty('metadata');
  });

  test('includes all 3 required caveats', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.caveats.length).toBe(3);
  });

  test('caveat includes "不构成因果结论"', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.caveats.some(c => c.includes('不构成因果结论'))).toBe(true);
  });

  test('includes all specific caveat texts', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.caveats).toContain('能力估计基于统计相关性，不构成因果结论');
    expect(explanation.caveats).toContain('样本量较小时估计不稳定');
    expect(explanation.caveats).toContain('解释仅供参考，不影响预测决策');
  });

  test('calculates confidence as product of prediction confidence and overall ability', () => {
    const explanation = generateExplanation(baseInput);

    // 0.85 * 0.72 = 0.612
    expect(explanation.confidence).toBeCloseTo(0.612, 3);
  });

  test('metadata contains all input values', () => {
    const explanation = generateExplanation(baseInput);

    expect(explanation.metadata.predictionProbability).toBe(0.75);
    expect(explanation.metadata.predictionConfidence).toBe(0.85);
    expect(explanation.metadata.studentAbility).toBe(0.7);
    expect(explanation.metadata.questionDifficulty).toBe(0.5);
  });

  test('primary reason reflects high probability case', () => {
    const highAbilityInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbility: 0.8, // ability > difficulty + 0.2 (0.5 + 0.2 = 0.7)
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
      studentAbility: 0.3,
      questionFeatures: { difficulty: 0.7, knowledgeNodes: ['math_1'] }
    };

    const explanation = generateExplanation(lowProbInput);

    expect(explanation.primaryReason).toContain('预测正确概率较低');
    // confidence = predictionConfidence * overallAbility = 0.85 * 0.72 = 0.612
    expect(explanation.confidence).toBeCloseTo(0.85 * 0.72, 3);
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

  test('handles empty abilities array', () => {
    const noAbilitiesInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbilityProfile: {
        ...baseInput.studentAbilityProfile,
        abilities: []
      }
    };

    const explanation = generateExplanation(noAbilitiesInput);

    expect(explanation.supportingFactors.some(f => f.includes('相关知识点'))).toBe(false);
  });

  test('handles zero total answers', () => {
    const noAnswersInput: GenerateExplanationInput = {
      ...baseInput,
      studentAbilityProfile: {
        ...baseInput.studentAbilityProfile,
        totalAnswers: 0,
        recentCorrectRate: 0.5
      }
    };

    const explanation = generateExplanation(noAnswersInput);

    expect(explanation.supportingFactors.some(f => f.includes('0') && f.includes('历史数据'))).toBe(true);
  });
});
