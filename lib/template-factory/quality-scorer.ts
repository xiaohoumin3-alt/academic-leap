import type { ValidationResult, QualityScore } from './types';

export interface ApprovalDecision {
  approve: boolean;
  reason: string;
  queue?: 'p0' | 'p1' | 'p2' | 'p3';
}

export class QualityScorer {
  /**
   * Calculate a multi-dimensional quality score from validation result.
   *
   * Weights:
   * - Math correctness: 40%
   * - Pedagogy quality: 30%
   * - Difficulty accuracy: 15%
   * - Completeness: 10%
   * - Innovation: 5%
   */
  calculate(validation: ValidationResult): QualityScore {
    // Math correctness is binary: 100 if passed, 0 if failed
    const mathCorrectness = validation.mathCorrectness.passed ? 100 : 0;

    // Pedagogy quality comes directly from validation
    const pedagogyQuality = validation.pedagogyQuality.score;

    // Difficulty accuracy is based on the confidence level
    const difficultyAccuracy = Math.round(validation.mathCorrectness.confidence * 100);

    // Completeness is reduced by the number of issues (10 points per issue)
    const issueCount =
      validation.mathCorrectness.issues.length +
      validation.pedagogyQuality.issues.length;
    const completeness = Math.max(0, 100 - issueCount * 10);

    // Innovation is derived from pedagogy quality (50% of pedagogy + 50 base)
    const innovation = Math.min(100, Math.round(pedagogyQuality * 0.5 + 50));

    // Overall score is weighted average
    const overall = Math.round(
      mathCorrectness * 0.4 +
        pedagogyQuality * 0.3 +
        difficultyAccuracy * 0.15 +
        completeness * 0.1 +
        innovation * 0.05
    );

    return {
      mathCorrectness,
      pedagogyQuality,
      difficultyAccuracy,
      completeness,
      innovation,
      overall,
    };
  }

  /**
   * Determine if a template should be auto-approved based on quality score.
   *
   * Auto-approval criteria:
   * - Math correctness must be 100 (no failures)
   * - Overall score >= 90 for auto-approval
   *
   * Returns an approval decision with reason and queue priority if not approved.
   */
  shouldAutoApprove(score: QualityScore): ApprovalDecision {
    // Math correctness failure is critical - queue as p0
    if (score.mathCorrectness < 100) {
      return {
        approve: false,
        reason: 'Math correctness failed',
        queue: 'p0',
      };
    }

    // High quality templates can be auto-approved
    if (score.overall >= 90) {
      return {
        approve: true,
        reason: 'High quality, auto-approved',
      };
    }

    // Determine queue priority based on overall score
    let queue: 'p1' | 'p2' | 'p3';
    if (score.overall >= 80) {
      queue = 'p2';
    } else if (score.overall >= 70) {
      queue = 'p1';
    } else {
      queue = 'p1';
    }

    return {
      approve: false,
      reason: `Quality score ${score.overall} requires review`,
      queue,
    };
  }

  /**
   * Get a human-readable quality category.
   */
  getQualityCategory(score: QualityScore): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score.overall >= 90) return 'excellent';
    if (score.overall >= 80) return 'good';
    if (score.overall >= 70) return 'fair';
    return 'poor';
  }
}
