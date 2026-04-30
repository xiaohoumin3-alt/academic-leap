// lib/rl/exploration/rl-exploration-controller.ts

import { HealthMonitor } from '../health/monitor';
import type {
  ExplorationConfig,
  ExplorationContext,
  ExplorationResult,
  ExplorationLevel,
} from './types';

/**
 * RL Exploration Controller
 *
 * Wraps HealthMonitor to determine candidate count for UOK recommendations.
 * Used as exploration enhancement layer for UOK recommendation engine.
 */
export class RLExplorationController {
  private readonly config: ExplorationConfig;
  private healthMonitor: HealthMonitor;
  private topicHistory: string[] = [];

  constructor(config?: Partial<ExplorationConfig>) {
    this.config = {
      baseCandidateCount: config?.baseCandidateCount ?? 2,
      maxCandidateCount: config?.maxCandidateCount ?? 5,
      explorationThreshold: config?.explorationThreshold ?? 0.3,
    };
    this.healthMonitor = new HealthMonitor();
  }

  /**
   * Get candidate count based on health status and context
   */
  getCandidateCount(context: ExplorationContext): ExplorationResult {
    const health = this.healthMonitor.check();
    const consecutiveSame = context.consecutiveSameTopic;

    let candidateCount = this.config.baseCandidateCount;
    let explorationLevel: ExplorationLevel = 'minimal';
    let reason = 'System healthy, minimal exploration';

    // Check if we have insufficient data for health assessment
    const hasEnoughData = health.metrics.le > 0 || health.metrics.cs > 0;

    // Adjust based on health level (only if we have enough data)
    if (hasEnoughData) {
      switch (health.level) {
        case 'warning':
          candidateCount = 3;
          explorationLevel = 'moderate';
          reason = `Health warning: ${health.alerts.join(', ') || 'low metrics'}`;
          break;

        case 'danger':
          candidateCount = 4;
          explorationLevel = 'aggressive';
          reason = `Health danger: ${health.alerts.join(', ') || 'critical metrics'}`;
          break;

        case 'collapsed':
          candidateCount = this.config.maxCandidateCount;
          explorationLevel = 'aggressive';
          reason = 'System collapsed, maximum exploration';
          break;
      }
    }

    // Adjust for pseudo-convergence (only when we have data)
    if (hasEnoughData && health.metrics.isPseudoConverged) {
      candidateCount = Math.min(candidateCount + 2, this.config.maxCandidateCount);
      explorationLevel = 'aggressive';
      reason = `Pseudo-convergence detected: ${health.metrics.pseudoConvergenceReason || 'unknown'}`;
    }

    // Adjust for consecutive same topic
    if (consecutiveSame >= 3) {
      candidateCount = Math.min(candidateCount + 1, this.config.maxCandidateCount);
      if (explorationLevel === 'minimal') {
        explorationLevel = 'moderate';
      }
      reason = `Consecutive same topic (${consecutiveSame}), increasing exploration`;
    }

    return {
      candidateCount,
      explorationLevel,
      factors: {
        healthLevel: health.level,
        consecutiveSameTopic: consecutiveSame,
        le: health.metrics.le,
        cs: health.metrics.cs,
      },
      reason,
    };
  }

  /**
   * Record a recommendation for history tracking
   */
  recordRecommendation(topic: string): void {
    this.topicHistory.push(topic);
    // Keep history limited
    if (this.topicHistory.length > 100) {
      this.topicHistory.shift();
    }
  }

  /**
   * Get consecutive count for a specific topic
   */
  getConsecutiveSameTopicCount(topic: string): number {
    let count = 0;
    for (let i = this.topicHistory.length - 1; i >= 0; i--) {
      if (this.topicHistory[i] === topic) {
        count++;
      } else {
        break;
      }
    }
    return Math.max(1, count);
  }

  /**
   * Record a response for health monitoring
   */
  recordResponse(response: {
    topic: string;
    correct: boolean;
    complexity: number;
  }): void {
    this.healthMonitor.recordResponse({
      theta: response.complexity * 3,
      deltaC: response.complexity * 10,
      correct: response.correct,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return this.healthMonitor.check();
  }
}
