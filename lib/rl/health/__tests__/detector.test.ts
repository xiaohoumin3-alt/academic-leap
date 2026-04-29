import { describe, it, expect } from 'bun:test';
import { detectFailure } from '../detector';
import type { HealthMetrics } from '../types';

describe('detectFailure', () => {
  it('should return healthy status when all metrics are good', () => {
    const metrics: HealthMetrics = {
      le: 0.35,
      cs: 0.92,
      labelNoiseRate: 0.01,
      feedbackDelaySteps: 2,
      dfi: 0.998,
      isPseudoConverged: false,
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('healthy');
    expect(result.metrics).toEqual(metrics);
    expect(result.alerts).toEqual([]);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should return warning when LE is low (0.08)', () => {
    const metrics: HealthMetrics = {
      le: 0.08,
      cs: 0.85,
      labelNoiseRate: 0.02,
      feedbackDelaySteps: 3,
      dfi: 0.995,
      isPseudoConverged: false,
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('warning');
    expect(result.alerts).toContainEqual(expect.stringContaining('LE=0.080'));
    expect(result.alerts).toContainEqual(expect.stringContaining('warning'));
  });

  it('should return danger when LE is zero', () => {
    const metrics: HealthMetrics = {
      le: 0,
      cs: 0.5,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 5,
      dfi: 0.95,
      isPseudoConverged: false,
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('danger');
    expect(result.alerts).toContainEqual(expect.stringContaining('LE=0.000'));
    expect(result.alerts).toContainEqual(expect.stringContaining('danger'));
  });

  it('should return warning/danger for high label noise levels', () => {
    const warningMetrics: HealthMetrics = {
      le: 0.25,
      cs: 0.8,
      labelNoiseRate: 0.15, // 15% noise - warning
      feedbackDelaySteps: 3,
      dfi: 0.99,
      isPseudoConverged: false,
    };

    const warningResult = detectFailure(warningMetrics);
    expect(warningResult.level).toBe('warning');
    expect(warningResult.alerts).toContainEqual(expect.stringContaining('标签噪声=15.0%'));

    const dangerMetrics: HealthMetrics = {
      le: 0.25,
      cs: 0.8,
      labelNoiseRate: 0.35, // 35% noise - danger
      feedbackDelaySteps: 3,
      dfi: 0.99,
      isPseudoConverged: false,
    };

    const dangerResult = detectFailure(dangerMetrics);
    expect(dangerResult.level).toBe('danger');
    expect(dangerResult.alerts).toContainEqual(expect.stringContaining('标签噪声=35.0%'));
  });

  it('should return collapsed when LE is negative and CS is low', () => {
    const metrics: HealthMetrics = {
      le: -0.05,
      cs: 0.3,
      labelNoiseRate: 0.1,
      feedbackDelaySteps: 10,
      dfi: 0.8,
      isPseudoConverged: false,
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('collapsed');
    expect(result.alerts).toContain('系统崩溃：LE为负且CS过低');
  });

  it('should include pseudo-convergence alerts', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.7,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 4,
      dfi: 0.98,
      isPseudoConverged: true,
      pseudoConvergenceReason: '探索率持续低于1%',
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('warning');
    expect(result.alerts).toContain('伪收敛: 探索率持续低于1%');
  });

  it('should aggregate multiple alerts and return worst level', () => {
    const metrics: HealthMetrics = {
      le: 0.02, // danger
      cs: 0.3, // danger
      labelNoiseRate: 0.4, // danger
      feedbackDelaySteps: 15, // danger
      dfi: 0.85, // alert
      isPseudoConverged: true,
      pseudoConvergenceReason: '多指标异常',
    };

    const result = detectFailure(metrics);

    expect(result.level).toBe('danger');
    expect(result.alerts.length).toBeGreaterThan(3);
    expect(result.alerts).toContainEqual(expect.stringContaining('LE=0.020'));
    expect(result.alerts).toContainEqual(expect.stringContaining('CS=0.30'));
    expect(result.alerts).toContainEqual(expect.stringContaining('标签噪声'));
    expect(result.alerts).toContainEqual(expect.stringContaining('反馈延迟'));
    expect(result.alerts).toContainEqual(expect.stringContaining('DFI'));
    expect(result.alerts).toContain('伪收敛: 多指标异常');
  });
});
