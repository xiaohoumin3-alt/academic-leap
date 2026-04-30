/**
 * Label Quality Model (LQM)
 *
 * Estimates question label quality and corrects noisy labels.
 *
 * Algorithm:
 * - Uses simplified IRT model: P(correct) = quality * IRT_prob + (1-quality) * 0.5
 * - Quality is derived from consistency between observed correct rate and IRT prediction
 * - Low quality labels are corrected using majority voting from high-theta students
 *
 * The LQM addresses the fundamental problem of noisy labels in educational data,
 * where incorrect labels can cause the RL policy to learn suboptimal strategies.
 */

import type { LQMConfig } from '../config/phase3-features';
import type { QuestionAttempt, QuestionQuality, CorrectedLabel, StudentResponse, QuestionHistory } from './types';

/**
 * Compute IRT probability of correct response
 * P(correct) = 1 / (1 + exp(-(theta - difficulty)))
 */
function irtProbability(theta: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(theta - difficulty)));
}

/**
 * Label Quality Model
 *
 * Estimates the quality of question labels and corrects noisy ones.
 * This is critical for the RL pipeline because noisy labels can cause
 * the policy to learn suboptimal strategies.
 */
export class LabelQualityModel {
  private config: LQMConfig;
  private questionData: Map<string, QuestionHistory> = new Map();

  constructor(config: LQMConfig) {
    this.config = config;
  }

  /**
   * Create model with default Phase 3 config
   */
  static createDefault(): LabelQualityModel {
    const config: LQMConfig = {
      noiseThreshold: 0.7,
      minAttempts: 20,
      decayRate: 0.95,
    };
    return new LabelQualityModel(config);
  }

  /**
   * Estimate the quality of a question's label
   *
   * Algorithm:
   * 1. Calculate mean theta
   * 2. Calculate observed correct rate
   * 3. Compute IRT-predicted probability
   * 4. Consistency score = 1 - |correctRate - IRT_pred|
   * 5. Sample size adjustment = min(1, attempts / minAttempts)
   * 6. Quality = consistency × sampleSizeAdjustment
   */
  estimateQuality(questionId: string, history: QuestionAttempt[], difficulty: number): QuestionQuality {
    let data = this.questionData.get(questionId);

    if (!data) {
      data = {
        attempts: [...history],
        lastQuality: null,
      };
      this.questionData.set(questionId, data);
    } else {
      // Update attempts with new history
      data.attempts = [...history];
    }

    if (history.length === 0) {
      const quality: QuestionQuality = {
        questionId,
        estimatedQuality: 0.5,
        confidence: 0,
        isNoisy: false,
      };
      data.lastQuality = quality;
      return quality;
    }

    // Step 1: Calculate mean theta
    const meanTheta = history.reduce((sum, h) => sum + h.theta, 0) / history.length;

    // Step 2: Calculate observed correct rate
    const correctCount = history.filter((h) => h.correct).length;
    const correctRate = correctCount / history.length;

    // Step 3: Compute IRT-predicted probability
    const irtPred = irtProbability(meanTheta, difficulty);

    // Step 4: Consistency score
    const consistency = 1 - Math.abs(correctRate - irtPred);

    // Step 5: Sample size adjustment
    const sampleSizeAdjustment = Math.min(1, history.length / this.config.minAttempts);

    // Step 6: Quality score
    const estimatedQuality = consistency * sampleSizeAdjustment;

    // Confidence based on sample size
    const confidence = Math.min(1, history.length / this.config.minAttempts);

    const quality: QuestionQuality = {
      questionId,
      estimatedQuality,
      confidence,
      isNoisy: estimatedQuality < this.config.noiseThreshold,
    };

    data.lastQuality = quality;
    return quality;
  }

  /**
   * Correct a potentially noisy label
   *
   * Strategy:
   * - If quality >= threshold: return original label (trust the label)
   * - If quality < threshold: use majority vote from high-theta students,
   *   or fall back to IRT model prediction
   */
  correctLabel(questionId: string, originalLabel: boolean): CorrectedLabel {
    const data = this.questionData.get(questionId);
    if (!data || !data.lastQuality) {
      // No history, trust original label
      return {
        value: originalLabel,
        wasCorrected: false,
        quality: 0.5,
      };
    }

    const quality = data.lastQuality;

    // If quality is high enough, trust the original label
    if (quality.estimatedQuality >= this.config.noiseThreshold) {
      return {
        value: originalLabel,
        wasCorrected: false,
        quality: quality.estimatedQuality,
      };
    }

    // Quality is low, need to correct
    const attempts = data.attempts;
    if (attempts.length === 0) {
      return {
        value: originalLabel,
        wasCorrected: false,
        quality: quality.estimatedQuality,
      };
    }

    // Strategy 1: Majority vote from high-theta students
    const thetaThreshold = 0; // Students with theta > 0 are above average
    const highThetaAttempts = attempts.filter((a) => a.theta > thetaThreshold);

    if (highThetaAttempts.length >= 3) {
      const highThetaCorrectRate = highThetaAttempts.filter((a) => a.correct).length / highThetaAttempts.length;
      const majorityVote = highThetaCorrectRate > 0.5;

      // Only correct if we're confident
      if (highThetaAttempts.length >= 10) {
        return {
          value: majorityVote,
          wasCorrected: true,
          quality: quality.estimatedQuality,
        };
      }
    }

    // Strategy 2: Use IRT model prediction
    const meanTheta = attempts.reduce((sum, a) => sum + a.theta, 0) / attempts.length;
    const irtPred = irtProbability(meanTheta, 0);
    const predictedCorrect = irtPred > 0.5;

    return {
      value: predictedCorrect,
      wasCorrected: true,
      quality: quality.estimatedQuality,
    };
  }

  /**
   * Update the model with a new student response
   *
   * Applies decay to existing quality estimates when new inconsistent data arrives.
   */
  update(questionId: string, response: StudentResponse): void {
    let data = this.questionData.get(questionId);

    if (!data) {
      data = {
        attempts: [],
        lastQuality: null,
      };
      this.questionData.set(questionId, data);
    }

    // Add the new attempt
    const attempt: QuestionAttempt = {
      correct: response.correct,
      theta: response.theta,
    };
    data.attempts.push(attempt);

    // Apply decay to existing quality if we have previous estimate
    if (data.lastQuality) {
      // Decay the quality based on consistency with new data
      const irtProb = irtProbability(response.theta, 0);
      const expectedCorrect = response.correct ? irtProb : (1 - irtProb);

      // Consistency: 1 - |actual_correct - expected_correct|
      // When expected is high but actual is wrong, consistency drops
      const consistency = 1 - Math.abs(expectedCorrect - irtProb);

      // Apply decay: penalize inconsistency
      const decayedQuality = data.lastQuality.estimatedQuality * this.config.decayRate * (0.5 + 0.5 * consistency);
      data.lastQuality.estimatedQuality = decayedQuality;
      data.lastQuality.confidence = Math.min(1, data.lastQuality.confidence * 0.95);
    }

    // Only recalculate quality from scratch if no prior estimate existed
    // This ensures decay is properly applied
    if (!data.lastQuality) {
      const difficulty = 0; // Default difficulty
      data.lastQuality = this.estimateQuality(questionId, data.attempts, difficulty);
    }
  }

  /**
   * Get the current quality estimate for a question
   */
  getQuality(questionId: string): QuestionQuality | undefined {
    return this.questionData.get(questionId)?.lastQuality ?? undefined;
  }

  /**
   * Get all tracked question IDs
   */
  getTrackedQuestions(): string[] {
    return Array.from(this.questionData.keys());
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.questionData.clear();
  }
}
