/**
 * Adaptation Controller
 *
 * Dynamically adjusts exploration rate based on confidence level and learning progress.
 * This addresses the problem of fixed exploration rates being suboptimal for robust learning.
 *
 * Algorithm:
 * - explorationRate = baseExplorationRate * (1-confidence)^speed * (1-progress)^(speed*2)
 * - explorationRate = max(minExplorationRate, explorationRate)
 *
 * Recommendation strategy:
 * - confidence < 0.4: explore
 * - confidence > 0.8: exploit
 * - otherwise: maintain
 */

import type { AdaptationConfig } from '../config/phase3-features';

// ============================================================================
// Types
// ============================================================================

export interface AdaptationState {
  /** Current exploration rate (0-1) */
  currentExplorationRate: number;
  /** Confidence level (0-1) */
  confidenceLevel: number;
  /** Learning progress (0-1) */
  learningProgress: number;
  /** Recommended action based on current state */
  recommendedAction: 'explore' | 'exploit' | 'maintain';
}

export interface HealthMetrics {
  /** Learning Effectiveness (LE) */
  le: number;
  /** Convergence Stability (CS) */
  cs: number;
  /** Confidence level (0-1) */
  confidence: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: AdaptationConfig = {
  baseExplorationRate: 0.1,
  minExplorationRate: 0.01,
  adaptationSpeed: 0.1,
  confidenceThreshold: 0.8,
};

// ============================================================================
// Adaptation Controller
// ============================================================================

/**
 * AdaptationController dynamically adjusts the exploration rate for RL algorithms.
 *
 * As the system becomes more confident and shows learning progress, the exploration
 * rate decreases. This allows the system to explore more when uncertain and exploit
 * more when confident.
 *
 * @example
 * ```ts
 * const controller = new AdaptationController();
 *
 * // Update with health metrics
 * controller.update({ le: 0.18, cs: 0.9, confidence: 0.7 });
 *
 * // Get current recommendation
 * const state = controller.getRecommendation();
 * console.log(state.recommendedAction); // 'maintain'
 * console.log(state.currentExplorationRate); // e.g., 0.05
 * ```
 */
export class AdaptationController {
  private config: AdaptationConfig;
  private confidenceLevel: number = 0;
  private learningProgress: number = 0;
  private currentExplorationRate: number;

  /**
   * Create an AdaptationController
   *
   * @param config - Configuration object (uses defaults if not provided)
   */
  constructor(config?: Partial<AdaptationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentExplorationRate = this.config.baseExplorationRate;
  }

  /**
   * Calculate exploration rate based on confidence and progress
   *
   * Formula: rate = base * (1-confidence)^speed * (1-progress)^(speed*2)
   * Result is clamped to minimum exploration rate
   *
   * @param confidence - Confidence level (0-1)
   * @param progress - Learning progress (0-1)
   * @returns Calculated exploration rate
   */
  calculateExplorationRate(confidence: number, progress: number): number {
    const { baseExplorationRate, minExplorationRate, adaptationSpeed } = this.config;

    // Clamp inputs
    const clampedConfidence = Math.max(0, Math.min(1, confidence));
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Calculate exploration rate using the adaptation formula
    const confidenceFactor = Math.pow(1 - clampedConfidence, adaptationSpeed);
    const progressFactor = Math.pow(1 - clampedProgress, adaptationSpeed * 2);

    const rate = baseExplorationRate * confidenceFactor * progressFactor;

    // Clamp to minimum
    return Math.max(minExplorationRate, rate);
  }

  /**
   * Update the controller with new health metrics
   *
   * @param metrics - Health metrics from the system
   */
  update(metrics: HealthMetrics): void {
    // Clamp confidence to valid range
    this.confidenceLevel = Math.max(0, Math.min(1, metrics.confidence));

    // Calculate learning progress from LE
    // LE target is 0.15, so we normalize around that target
    // Progress = 0 when LE = 0, progress = 1 when LE >= 0.3
    const targetLE = 0.15;
    const maxLE = 0.3;
    this.learningProgress = Math.max(0, Math.min(1, metrics.le / maxLE));

    // Recalculate exploration rate
    this.currentExplorationRate = this.calculateExplorationRate(
      this.confidenceLevel,
      this.learningProgress
    );
  }

  /**
   * Get the current recommendation state
   *
   * @returns AdaptationState with current exploration rate, confidence, progress,
   *          and recommended action
   */
  getRecommendation(): AdaptationState {
    const { confidenceThreshold } = this.config;

    // Determine recommended action based on confidence level
    let recommendedAction: 'explore' | 'exploit' | 'maintain';

    if (this.confidenceLevel < 0.4) {
      recommendedAction = 'explore';
    } else if (this.confidenceLevel > confidenceThreshold) {
      recommendedAction = 'exploit';
    } else {
      recommendedAction = 'maintain';
    }

    return {
      currentExplorationRate: this.currentExplorationRate,
      confidenceLevel: this.confidenceLevel,
      learningProgress: this.learningProgress,
      recommendedAction,
    };
  }

  /**
   * Get the current configuration
   *
   * @returns Current configuration object
   */
  getConfig(): AdaptationConfig {
    return { ...this.config };
  }

  /**
   * Get the current exploration rate
   *
   * @returns Current exploration rate
   */
  getExplorationRate(): number {
    return this.currentExplorationRate;
  }

  /**
   * Reset the controller to initial state
   */
  reset(): void {
    this.confidenceLevel = 0;
    this.learningProgress = 0;
    this.currentExplorationRate = this.config.baseExplorationRate;
  }
}
