// lib/rl/health/monitor.ts

import type { ResponseRecord, RecommendationRecord, HealthMetrics, HealthStatus } from './types';
import { calculateLE, calculateCS, calculateLabelNoiseRate, calculateDFI } from './metrics';
import { detectFailure } from './detector';
import { detectPseudoConvergence } from './pseudo-convergence';

/**
 * 健康监控类
 *
 * 跟踪响应、推荐和事件历史，计算健康指标，检测系统状态
 */
export class HealthMonitor {
  private responseHistory: ResponseRecord[] = [];
  private recommendationHistory: RecommendationRecord[] = [];
  private totalEvents = 0;
  private completeEvents = 0;

  /**
   * 记录答题响应
   */
  recordResponse(response: ResponseRecord): void {
    this.responseHistory.push({ ...response });
  }

  /**
   * 记录推荐
   */
  recordRecommendation(rec: RecommendationRecord): void {
    this.recommendationHistory.push({ ...rec });
  }

  /**
   * 记录事件（用于DFI计算）
   */
  recordEvent(complete: boolean): void {
    this.totalEvents++;
    if (complete) {
      this.completeEvents++;
    }
  }

  /**
   * 获取当前健康指标
   */
  getMetrics(): HealthMetrics {
    const le = calculateLE(this.responseHistory);
    const cs = calculateCS(this.recommendationHistory);
    const labelNoiseRate = calculateLabelNoiseRate(this.responseHistory);
    const dfi = calculateDFI(this.totalEvents, this.completeEvents);

    // Reward丢失率：计算反馈延迟步数比例
    const feedbackDelaySteps = this.totalEvents - this.completeEvents;
    const rewardLossRate = this.totalEvents > 0 ? feedbackDelaySteps / this.totalEvents : 0;

    const baseMetrics: HealthMetrics = {
      le,
      cs,
      dfi,
      labelNoiseRate,
      feedbackDelaySteps,
      rewardLossRate,
      isPseudoConverged: false,
    };

    // 检测伪收敛
    const pseudoConvergenceResult = detectPseudoConvergence(baseMetrics);
    return {
      ...baseMetrics,
      isPseudoConverged: pseudoConvergenceResult.isPseudoConverged,
      pseudoConvergenceReason: pseudoConvergenceResult.reason,
    };
  }

  /**
   * 检查当前健康状态
   */
  check(): HealthStatus {
    const metrics = this.getMetrics();
    return detectFailure(metrics);
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.responseHistory = [];
    this.recommendationHistory = [];
    this.totalEvents = 0;
    this.completeEvents = 0;
  }

  /**
   * 获取响应历史副本
   */
  getResponseHistory(): ResponseRecord[] {
    return [...this.responseHistory];
  }

  /**
   * 获取推荐历史副本
   */
  getRecommendationHistory(): RecommendationRecord[] {
    return [...this.recommendationHistory];
  }

  /**
   * 获取事件计数
   */
  getEventCounts(): { total: number; complete: number } {
    return {
      total: this.totalEvents,
      complete: this.completeEvents,
    };
  }
}
