/**
 * Label Quality Model Types
 *
 * Interfaces for the LQM which estimates question label quality
 * and corrects noisy labels in the RL pipeline.
 */

/**
 * A single question attempt record
 */
export interface QuestionAttempt {
  /** Whether the student answered correctly */
  correct: boolean;
  /** Estimated student ability (IRT theta) at time of attempt */
  theta: number;
}

/**
 * Estimated quality of a question's label
 */
export interface QuestionQuality {
  /** Question identifier */
  questionId: string;
  /** Estimated label quality score [0, 1] */
  estimatedQuality: number;
  /** Confidence in the estimate [0, 1] */
  confidence: number;
  /** Whether the label is considered noisy */
  isNoisy: boolean;
}

/**
 * A corrected label with quality metadata
 */
export interface CorrectedLabel {
  /** The label value (original or corrected) */
  value: boolean;
  /** Whether the original label was corrected */
  wasCorrected: boolean;
  /** Quality score of the label */
  quality: number;
}

/**
 * A student's response to a question
 */
export interface StudentResponse {
  /** Whether the student answered correctly */
  correct: boolean;
  /** Student's estimated ability at time of response */
  theta: number;
}

/**
 * Internal storage for question history
 */
export interface QuestionHistory {
  attempts: QuestionAttempt[];
  lastQuality: QuestionQuality | null;
}
