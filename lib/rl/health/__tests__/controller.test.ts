import { describe, test, expect } from 'bun:test';
import { decideDegradation } from '../controller';
import type { HealthStatus } from '../types';

describe('Degradation Controller', () => {
  test('healthy → continue', () => {
    const status: HealthStatus = {
      level: 'healthy',
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: false,
      },
      alerts: [],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('continue');
    expect(action.reason).toBe('System normal');
  });

  test('warning → increase_exploration', () => {
    const status: HealthStatus = {
      level: 'warning',
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: false,
      },
      alerts: ['标签噪声率偏高', '反馈延迟增大'],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('increase_exploration');
    expect(action.reason).toContain('标签噪声率偏高');
    expect(action.reason).toContain('增大exploration');
  });

  test('danger → switch_to_rule', () => {
    const status: HealthStatus = {
      level: 'danger',
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: false,
      },
      alerts: ['数据链断裂', 'DFI低于阈值'],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('switch_to_rule');
    expect(action.reason).toContain('数据链断裂');
    expect(action.reason).toContain('切换到规则引擎兜底');
  });

  test('collapsed → stop', () => {
    const status: HealthStatus = {
      level: 'collapsed',
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: false,
      },
      alerts: ['系统完全崩溃', '无法恢复'],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('stop');
    expect(action.reason).toContain('系统完全崩溃');
    expect(action.reason).toContain('需要人工介入');
  });

  test('pseudo-convergence → switch_to_rule (special case)', () => {
    const status: HealthStatus = {
      level: 'healthy', // 即使是healthy状态，伪收敛也会触发切换
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: true,
        pseudoConvergenceReason: '推荐集中在少数简单题目',
      },
      alerts: [],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('switch_to_rule');
    expect(action.reason).toContain('伪收敛检测到');
    expect(action.reason).toContain('推荐集中在少数简单题目');
  });

  test('pseudo-convergence with unknown reason', () => {
    const status: HealthStatus = {
      level: 'warning',
      metrics: {
        le: 0.8,
        cs: 0.9,
        dfi: 0.99,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0,
        isPseudoConverged: true,
        // 没有提供 pseudoConvergenceReason
      },
      alerts: ['其他告警'],
      timestamp: new Date(),
    };

    const action = decideDegradation(status);

    expect(action.type).toBe('switch_to_rule');
    expect(action.reason).toContain('伪收敛检测到');
    expect(action.reason).toContain('未知原因');
  });
});
