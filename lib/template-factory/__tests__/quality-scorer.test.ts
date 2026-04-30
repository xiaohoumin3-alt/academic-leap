import { describe, it, expect, beforeEach } from '@jest/globals';
import { QualityScorer } from '../quality-scorer';
import type { ValidationResult, QualityScore } from '../types';

describe('QualityScorer', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  it('should calculate quality score from validation result', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 88 },
      overallScore: 92,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);

    expect(score.overall).toBeGreaterThan(80);
    expect(score.mathCorrectness).toBe(100);
    expect(score.pedagogyQuality).toBe(88);
  });

  it('should auto-approve high quality templates', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 1.0 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 95,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(true);
    expect(decision.reason).toBe('High quality, auto-approved');
  });

  it('should not auto-approve templates with math issues', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: false, issues: ['Calculation error'], confidence: 0.9 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 80,
      recommendation: 'reject',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.reason).toContain('Math');
  });

  it('should categorize excellent quality', () => {
    const score: QualityScore = {
      mathCorrectness: 100,
      pedagogyQuality: 90,
      difficultyAccuracy: 95,
      completeness: 90,
      innovation: 85,
      overall: 92,
    };

    expect(scorer.getQualityCategory(score)).toBe('excellent');
  });

  it('should categorize good quality', () => {
    const score: QualityScore = {
      mathCorrectness: 100,
      pedagogyQuality: 85,
      difficultyAccuracy: 80,
      completeness: 85,
      innovation: 75,
      overall: 85,
    };

    expect(scorer.getQualityCategory(score)).toBe('good');
  });

  it('should categorize fair quality', () => {
    const score: QualityScore = {
      mathCorrectness: 100,
      pedagogyQuality: 70,
      difficultyAccuracy: 70,
      completeness: 70,
      innovation: 65,
      overall: 75,
    };

    expect(scorer.getQualityCategory(score)).toBe('fair');
  });

  it('should categorize poor quality', () => {
    const score: QualityScore = {
      mathCorrectness: 0,
      pedagogyQuality: 50,
      difficultyAccuracy: 50,
      completeness: 50,
      innovation: 40,
      overall: 40,
    };

    expect(scorer.getQualityCategory(score)).toBe('poor');
  });

  it('should queue p0 for math correctness failures', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: false, issues: ['Calculation error'], confidence: 0.9 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 80,
      recommendation: 'reject',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.queue).toBe('p0');
  });

  it('should queue p2 for good quality below auto-approval', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.80 },
      pedagogyQuality: { passed: true, issues: ['Minor styling issue'], score: 78 },
      overallScore: 82,
      recommendation: 'review',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.queue).toBe('p2');
  });

  it('should queue p1 for fair quality', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.60 },
      pedagogyQuality: { passed: true, issues: ['Minor issue 1', 'Minor issue 2', 'Minor issue 3', 'Minor issue 4'], score: 60 },
      overallScore: 75,
      recommendation: 'review',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.queue).toBe('p1');
  });

  it('should calculate difficulty accuracy from confidence', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.85 },
      pedagogyQuality: { passed: true, issues: [], score: 80 },
      overallScore: 85,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);

    expect(score.difficultyAccuracy).toBe(85);
  });

  it('should reduce completeness based on issue count', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: ['Minor issue 1', 'Minor issue 2'], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: ['Style issue'], score: 85 },
      overallScore: 88,
      recommendation: 'review',
    };

    const score = scorer.calculate(validation);

    // 3 issues * 10 = 30 point reduction
    expect(score.completeness).toBe(70);
  });

  it('should cap completeness at 0', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: new Array(15).fill('Issue'), confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 85 },
      overallScore: 70,
      recommendation: 'reject',
    };

    const score = scorer.calculate(validation);

    expect(score.completeness).toBe(0);
  });

  it('should calculate innovation based on pedagogy quality', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 92,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);

    // innovation = min(100, pedagogyQuality * 0.5 + 50) = min(100, 90 * 0.5 + 50) = 95
    expect(score.innovation).toBe(95);
  });
});
