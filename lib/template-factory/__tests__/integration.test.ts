import { describe, it, expect } from '@jest/globals';
import { QualityScorer } from '../quality-scorer';

describe('Template Factory Integration', () => {
  it('should complete quality scoring pipeline', () => {
    const scorer = new QualityScorer();

    const validation = {
      templateId: 'test-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 88 },
      overallScore: 92,
      recommendation: 'approve' as const,
    };

    const score = scorer.calculate(validation);
    expect(score.overall).toBeGreaterThan(80);

    const decision = scorer.shouldAutoApprove(score);
    expect(decision.approve).toBe(true);
  });

  it('should handle quality categories correctly', () => {
    const scorer = new QualityScorer();

    expect(scorer.getQualityCategory({ overall: 95, mathCorrectness: 100, pedagogyQuality: 90, difficultyAccuracy: 95, completeness: 100, innovation: 95 })).toBe('excellent');
    expect(scorer.getQualityCategory({ overall: 85, mathCorrectness: 100, pedagogyQuality: 85, difficultyAccuracy: 85, completeness: 100, innovation: 92 })).toBe('good');
    expect(scorer.getQualityCategory({ overall: 75, mathCorrectness: 100, pedagogyQuality: 75, difficultyAccuracy: 75, completeness: 100, innovation: 87 })).toBe('fair');
    expect(scorer.getQualityCategory({ overall: 60, mathCorrectness: 100, pedagogyQuality: 60, difficultyAccuracy: 60, completeness: 100, innovation: 80 })).toBe('poor');
  });
});