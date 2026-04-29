// lib/rl/monitor/distribution.ts

import { detectDifficultyDrift, type QuestionAttempt } from './difficulty-drift';
import { detectAbilityDrift } from './ability-drift';

/**
 * Configuration for DistributionMonitor
 */
export interface DistributionMonitorConfig {
  /** Number of checks between full distribution analysis */
  checkInterval: number;
  /** Threshold for critical severity (e.g., 0.4 = 40% change) */
  criticalThreshold: number;
  /** Threshold for warning severity (e.g., 0.2 = 20% change) */
  warningThreshold: number;
}

/**
 * Input data for distribution check
 */
export interface DistributionCheckInput {
  /** History of question attempts */
  questionHistory: QuestionAttempt[];
  /** History of student ability (theta) values */
  thetaHistory: number[];
  /** History of reward values */
  rewardHistory: number[];
}

/**
 * Alert type - which distribution has drifted
 */
export type DistributionAlertType = 'difficulty' | 'ability' | 'reward';

/**
 * Alert severity level
 */
export type DistributionAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Recommendation based on alert severity
 */
export type DistributionAlertRecommendation = 'continue' | 'recalibrate' | 'reset';

/**
 * Distribution alert generated when drift is detected
 */
export interface DistributionAlert {
  /** Type of distribution that drifted */
  type: DistributionAlertType;
  /** Severity level of the alert */
  severity: DistributionAlertSeverity;
  /** Human-readable message describing the alert */
  message: string;
  /** Recommended action */
  recommendation: DistributionAlertRecommendation;
  /** When the alert was generated */
  timestamp: Date;
}

/**
 * Current state of the DistributionMonitor
 */
export interface DistributionMonitorState {
  /** Total number of checks performed */
  checkCount: number;
  /** Timestamp of last check, or null if no checks yet */
  lastCheck: Date | null;
  /** Accumulated alerts from all checks */
  alerts: DistributionAlert[];
}

/**
 * Priority order for alerts (lower index = higher priority)
 */
const ALERT_PRIORITY: DistributionAlertType[] = ['reward', 'ability', 'difficulty'];

/**
 * Comprehensive distribution monitor that integrates all drift detectors
 *
 * Monitors three key distributions:
 * - Difficulty drift: Changes in question difficulty over time
 * - Ability drift: Changes in student theta values over time
 * - Reward drift: Changes in RL reward signals over time
 *
 * Alert priority: reward > ability > difficulty
 */
export class DistributionMonitor {
  private config: DistributionMonitorConfig;
  private checkCountValue: number;
  private lastCheckValue: Date | null;
  private alertsValue: DistributionAlert[];

  constructor(config: DistributionMonitorConfig) {
    this.config = config;
    this.checkCountValue = 0;
    this.lastCheckValue = null;
    this.alertsValue = [];
  }

  /**
   * Check distributions and generate alerts if drift is detected
   *
   * Full distribution analysis is performed every `checkInterval` calls.
   * Intermediate calls increment the counter but don't perform analysis.
   *
   * @param input - Input data for distribution check
   * @returns Array of alerts (empty if no drift detected or interval not reached)
   */
  check(input: DistributionCheckInput): DistributionAlert[] {
    this.checkCountValue++;
    this.lastCheckValue = new Date();

    // Only perform full check at specified intervals
    if (this.checkCountValue % this.config.checkInterval !== 0) {
      return [];
    }

    // Perform all drift checks
    const alerts: DistributionAlert[] = [];

    // Check reward drift (highest priority)
    const rewardAlert = this.checkRewardDrift(input.rewardHistory);
    if (rewardAlert) {
      alerts.push(rewardAlert);
    }

    // Check ability drift (medium priority)
    const abilityAlert = this.checkAbilityDrift(input.thetaHistory);
    if (abilityAlert) {
      alerts.push(abilityAlert);
    }

    // Check difficulty drift (lowest priority)
    const difficultyAlerts = this.checkDifficultyDrift(input.questionHistory);
    alerts.push(...difficultyAlerts);

    // Sort by priority
    alerts.sort((a, b) => {
      const aPriority = ALERT_PRIORITY.indexOf(a.type);
      const bPriority = ALERT_PRIORITY.indexOf(b.type);
      return aPriority - bPriority;
    });

    // Accumulate alerts
    this.alertsValue.push(...alerts);

    return alerts;
  }

  /**
   * Get current monitor state
   */
  getState(): DistributionMonitorState {
    return {
      checkCount: this.checkCountValue,
      lastCheck: this.lastCheckValue,
      alerts: [...this.alertsValue],
    };
  }

  /**
   * Clear all accumulated alerts
   */
  clearAlerts(): void {
    this.alertsValue = [];
  }

  /**
   * Check for reward drift
   *
   * Generates alerts for any measurable drift, with severity based on magnitude.
   */
  private checkRewardDrift(rewardHistory: number[]): DistributionAlert | null {
    // Need at least 2 values for comparison
    if (rewardHistory.length < 2) {
      return null;
    }

    // Split into halves for comparison
    const midPoint = Math.floor(rewardHistory.length / 2);
    const olderHalf = rewardHistory.slice(0, midPoint);
    const recentHalf = rewardHistory.slice(midPoint);

    // Calculate means
    const oldMean = this.calculateMean(olderHalf);
    const newMean = this.calculateMean(recentHalf);

    // Avoid division by zero
    if (oldMean === 0) {
      return null;
    }

    // Calculate percentage change
    const changePercent = (newMean - oldMean) / oldMean;

    const severity = this.calculateSeverity(changePercent);
    const recommendation = this.getRecommendation(severity);

    return {
      type: 'reward',
      severity,
      message: `Reward drift detected: ${Math.abs(changePercent * 100).toFixed(1)}% ` +
        `change (${oldMean.toFixed(3)} → ${newMean.toFixed(3)})`,
      recommendation,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate mean of values (local utility to avoid dependency)
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Check for ability drift
   */
  private checkAbilityDrift(thetaHistory: number[]): DistributionAlert | null {
    const drift = detectAbilityDrift(thetaHistory);

    if (!drift) {
      return null;
    }

    // Calculate change as percentage of old mean
    const changePercent = drift.oldMean !== 0
      ? (drift.newMean - drift.oldMean) / Math.abs(drift.oldMean)
      : drift.newMean;

    const severity = this.calculateSeverity(changePercent);
    const recommendation = this.getRecommendation(severity);

    return {
      type: 'ability',
      severity,
      message: `Ability drift detected: theta changed from ${drift.oldMean.toFixed(3)} ` +
        `(${drift.oldStd.toFixed(3)}) to ${drift.newMean.toFixed(3)} (${drift.newStd.toFixed(3)})`,
      recommendation,
      timestamp: new Date(),
    };
  }

  /**
   * Check for difficulty drift across all questions
   */
  private checkDifficultyDrift(questionHistory: QuestionAttempt[]): DistributionAlert[] {
    // Group attempts by questionId
    const questionGroups = new Map<string, QuestionAttempt[]>();

    for (const attempt of questionHistory) {
      const existing = questionGroups.get(attempt.questionId) || [];
      existing.push(attempt);
      questionGroups.set(attempt.questionId, existing);
    }

    const alerts: DistributionAlert[] = [];

    // Check each question for drift
    for (const [questionId, attempts] of questionGroups) {
      // Use initial difficulty of 0 as baseline
      const drift = detectDifficultyDrift(questionHistory, questionId, 0);

      if (drift.significance !== 'insignificant') {
        const severity = this.calculateDifficultySeverity(drift.driftAmount);
        const recommendation = this.getRecommendation(severity);

        alerts.push({
          type: 'difficulty',
          severity,
          message: `Difficulty drift detected for question ${questionId}: ` +
            `${drift.oldDifficulty.toFixed(3)} → ${drift.newDifficulty.toFixed(3)} ` +
            `(${drift.significance})`,
          recommendation,
          timestamp: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Calculate severity based on percentage change
   */
  private calculateSeverity(changePercent: number): DistributionAlertSeverity {
    const absChange = Math.abs(changePercent);

    if (absChange >= this.config.criticalThreshold) {
      return 'critical';
    } else if (absChange >= this.config.warningThreshold) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Calculate severity for difficulty drift (absolute amount, not percentage)
   */
  private calculateDifficultySeverity(driftAmount: number): DistributionAlertSeverity {
    if (driftAmount >= 0.3) {
      return 'critical';
    } else if (driftAmount >= 0.2) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Get recommendation based on severity
   */
  private getRecommendation(severity: DistributionAlertSeverity): DistributionAlertRecommendation {
    switch (severity) {
      case 'critical':
        return 'reset';
      case 'warning':
        return 'recalibrate';
      case 'info':
      default:
        return 'continue';
    }
  }
}
