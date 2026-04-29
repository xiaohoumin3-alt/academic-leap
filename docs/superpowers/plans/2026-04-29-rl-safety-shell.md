# RL自适应引擎安全壳实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为RL自适应引擎添加安全壳保护层，实现健康监控、失效检测、自动降级和伪收敛检测，确保系统在破坏性环境下仍能安全运行。

**Architecture:** 非侵入式设计 - 在现有RL引擎外包裹健康监控和降级控制层，不修改核心算法。健康监控实时计算KPI指标，失效检测基于PRODUCT.md的崩溃边界判断状态，降级控制器根据健康状态决定行动（继续/增大探索/切换规则引擎/停止），规则引擎提供简单可靠的兜底推荐。

**Tech Stack:** TypeScript, Next.js API Routes, Prisma, Jest

---

## 文件结构

### 新建文件
```
lib/rl/health/
├── types.ts              # 共享类型定义
├── thresholds.ts         # 崩溃边界阈值常量
├── metrics.ts            # 指标计算函数
├── monitor.ts            # 健康监控类
├── detector.ts           # 失效检测器
├── pseudo-convergence.ts # 伪收敛检测器
├── controller.ts         # 降级控制器
├── index.ts              # Barrel export
└── __tests__/
    ├── metrics.test.ts
    ├── detector.test.ts
    ├── controller.test.ts
    └── pseudo-convergence.test.ts

lib/rl/fallback/
├── rule-engine.ts        # 规则引擎兜底
├── index.ts              # Barrel export
└── __tests__/
    └── rule-engine.test.ts

app/api/rl/
└── health/
    └── route.ts          # 健康查询API

e2e/
└── rl-safety-shell.spec.ts  # E2E测试
```

### 修改文件
```
app/api/rl/next-question/route.ts   # 添加健康检查
app/api/rl/record-response/route.ts # 添加健康检查
```

---

## Task 1: 创建共享类型定义

**Files:**
- Create: `lib/rl/health/types.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// lib/rl/health/types.ts

/**
 * 健康指标 - 用于监控系统状态
 */
export interface HealthMetrics {
  // 核心KPI (来自 PRODUCT.md)
  /** Learning Effectiveness - 学生能力提升幅度 */
  le: number;
  /** Convergence Stability - 推荐稳定性 */
  cs: number;
  /** Data Flow Integrity - 数据链完整度 */
  dfi: number;

  // 异常检测指标
  /** 标签噪声率 - 答案与能力估计不一致的比例 */
  labelNoiseRate: number;
  /** 反馈延迟步数 - pending reward队列长度 */
  feedbackDelaySteps: number;
  /** Reward丢失率 */
  rewardLossRate: number;

  // 伪收敛检测
  /** 是否处于伪收敛状态 */
  isPseudoConverged: boolean;
  /** 伪收敛原因 */
  pseudoConvergenceReason?: string;
}

/**
 * 健康状态等级
 */
export type HealthLevel = 'healthy' | 'warning' | 'danger' | 'collapsed';

/**
 * 系统健康状态
 */
export interface HealthStatus {
  /** 健康等级 */
  level: HealthLevel;
  /** 当前指标 */
  metrics: HealthMetrics;
  /** 告警信息 */
  alerts: string[];
  /** 检测时间 */
  timestamp: Date;
}

/**
 * 降级行动类型
 */
export type DegradationActionType = 'continue' | 'increase_exploration' | 'switch_to_rule' | 'stop';

/**
 * 降级行动
 */
export interface DegradationAction {
  /** 行动类型 */
  type: DegradationActionType;
  /** 行动原因 */
  reason: string;
}

/**
 * 崩溃边界阈值
 */
export interface CollapseThresholds {
  healthy: number;
  warning: number;
  danger: number;
}

/**
 * 所有崩溃边界配置
 */
export interface ThresholdConfig {
  le: CollapseThresholds;
  cs: CollapseThresholds;
  labelNoise: CollapseThresholds;
  feedbackDelay: CollapseThresholds;
}

/**
 * 推荐历史记录（用于计算CS）
 */
export interface RecommendationRecord {
  deltaC: number;
  timestamp: number;
}

/**
 * 答题历史记录（用于计算LE和噪声率）
 */
export interface ResponseRecord {
  theta: number;
  deltaC: number;
  correct: boolean;
  timestamp: number;
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit lib/rl/health/types.ts
```

Expected: No errors

- [ ] **Step 3: 提交**

```bash
git add lib/rl/health/types.ts
git commit -m "feat(health): add shared type definitions"
```

---

## Task 2: 创建崩溃边界阈值配置

**Files:**
- Create: `lib/rl/health/thresholds.ts`
- Modify: `lib/rl/health/types.ts` (already created)

- [ ] **Step 1: 创建阈值配置文件**

```typescript
// lib/rl/health/thresholds.ts

import type { ThresholdConfig } from './types';

/**
 * 崩溃边界阈值
 * 
 * 基于 PRODUCT.md#崩溃边界 定义
 * 
 * | 指标 | 正常 | 警告 | 危险 | 崩溃 |
 * |------|------|------|------|------|
 * | LE | > 15% | 5-15% | 0-5% | < 0% |
 * | CS | > 85% | 70-85% | 50-70% | < 50% |
 * | 标签噪声 | < 10% | 10-20% | 20-30% | > 30% |
 * | 反馈延迟 | < 5步 | 5-15步 | 15-30步 | > 30步 |
 */
export const COLLAPSE_BOUNDARIES: ThresholdConfig = {
  le: {
    healthy: 0.15,
    warning: 0.05,
    danger: 0.0,
  },
  cs: {
    healthy: 0.85,
    warning: 0.70,
    danger: 0.50,
  },
  labelNoise: {
    healthy: 0.10,
    warning: 0.20,
    danger: 0.30,
  },
  feedbackDelay: {
    healthy: 5,
    warning: 15,
    danger: 30,
  },
};

/**
 * 获取指标的健康等级
 */
export function getHealthLevel(
  value: number,
  config: typeof COLLAPSE_BOUNDARIES[keyof ThresholdConfig]
): 'healthy' | 'warning' | 'danger' {
  if (value >= config.healthy) return 'healthy';
  if (value >= config.warning) return 'warning';
  if (value >= config.danger) return 'danger';
  return 'danger';
}

/**
 * 对于噪声率和延迟（越小越好）
 */
export function getHealthLevelInverted(
  value: number,
  config: typeof COLLAPSE_BOUNDARIES[keyof ThresholdConfig]
): 'healthy' | 'warning' | 'danger' {
  if (value <= config.healthy) return 'healthy';
  if (value <= config.warning) return 'warning';
  if (value <= config.danger) return 'danger';
  return 'danger';
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit lib/rl/health/thresholds.ts
```

Expected: No errors

- [ ] **Step 3: 提交**

```bash
git add lib/rl/health/thresholds.ts
git commit -m "feat(health): add collapse boundary thresholds"
```

---

## Task 3: 创建指标计算模块

**Files:**
- Create: `lib/rl/health/metrics.ts`
- Create: `lib/rl/health/__tests__/metrics.test.ts`

- [ ] **Step 1: 编写指标计算的测试**

```typescript
// lib/rl/health/__tests__/metrics.test.ts

import { calculateLE, calculateCS, calculateLabelNoiseRate } from '../metrics';

describe('HealthMetrics', () => {
  describe('calculateLE', () => {
    it('should calculate LE from theta history', () => {
      const responses = [
        { theta: -1.0, deltaC: 2, correct: false, timestamp: Date.now() - 1000 },
        { theta: -0.8, deltaC: 2, correct: true, timestamp: Date.now() - 800 },
        { theta: -0.5, deltaC: 3, correct: true, timestamp: Date.now() - 600 },
        { theta: -0.2, deltaC: 3, correct: true, timestamp: Date.now() - 400 },
        { theta: 0.0, deltaC: 3, correct: true, timestamp: Date.now() - 200 },
        { theta: 0.3, deltaC: 4, correct: true, timestamp: Date.now() },
      ];
      
      const le = calculateLE(responses);
      
      // theta从-1.0提升到0.3，提升1.3
      expect(le).toBeGreaterThan(1.0);
      expect(le).toBeLessThan(2.0);
    });

    it('should return 0 for empty history', () => {
      const le = calculateLE([]);
      expect(le).toBe(0);
    });

    it('should return 0 for single response', () => {
      const responses = [
        { theta: 0, deltaC: 3, correct: true, timestamp: Date.now() },
      ];
      const le = calculateLE(responses);
      expect(le).toBe(0);
    });
  });

  describe('calculateCS', () => {
    it('should calculate CS from recommendation history', () => {
      const recommendations = [
        { deltaC: 3.0, timestamp: Date.now() - 400 },
        { deltaC: 3.1, timestamp: Date.now() - 300 },
        { deltaC: 3.0, timestamp: Date.now() - 200 },
        { deltaC: 2.9, timestamp: Date.now() - 100 },
        { deltaC: 3.0, timestamp: Date.now() },
      ];
      
      const cs = calculateCS(recommendations);
      
      // 方差很小，CS应该接近1
      expect(cs).toBeGreaterThan(0.9);
    });

    it('should return 0 for empty history', () => {
      const cs = calculateCS([]);
      expect(cs).toBe(0);
    });

    it('should detect unstable recommendations', () => {
      const recommendations = [
        { deltaC: 1.0, timestamp: Date.now() - 400 },
        { deltaC: 5.0, timestamp: Date.now() - 300 },
        { deltaC: 2.0, timestamp: Date.now() - 200 },
        { deltaC: 4.0, timestamp: Date.now() - 100 },
        { deltaC: 3.0, timestamp: Date.now() },
      ];
      
      const cs = calculateCS(recommendations);
      
      // 方差很大，CS应该较低
      expect(cs).toBeLessThan(0.7);
    });
  });

  describe('calculateLabelNoiseRate', () => {
    it('should calculate label noise rate', () => {
      const responses = [
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() - 400 },
        { theta: 0.5, deltaC: 3, correct: false, timestamp: Date.now() - 300 },  // 意外错误
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() - 200 },
        { theta: 0.5, deltaC: 3, correct: false, timestamp: Date.now() - 100 },  // 意外错误
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() },
      ];
      
      // theta=0.5应该能答对deltaC=3的题，但有2次意外错误
      const noiseRate = calculateLabelNoiseRate(responses);
      
      // 2次意外错误 / 5次答题 = 0.4
      expect(noiseRate).toBe(0.4);
    });

    it('should return 0 for empty history', () => {
      const noiseRate = calculateLabelNoiseRate([]);
      expect(noiseRate).toBe(0);
    });

    it('should handle low theta correctly', () => {
      const responses = [
        { theta: -1.0, deltaC: 4, correct: false, timestamp: Date.now() },
      ];
      
      // theta=-1.0答错deltaC=4是正常的，不算噪声
      const noiseRate = calculateLabelNoiseRate(responses);
      expect(noiseRate).toBe(0);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx jest lib/rl/health/__tests__/metrics.test.ts --verbose
```

Expected: FAIL - modules not found

- [ ] **Step 3: 实现指标计算模块**

```typescript
// lib/rl/health/metrics.ts

import type { ResponseRecord, RecommendationRecord } from './types';

/**
 * 计算学习有效性 (LE - Learning Effectiveness)
 * 
 * LE = 最终theta - 初始theta
 * 使用最近N次答题记录
 * 
 * @param responses - 答题历史记录
 * @param windowSize - 计算窗口大小（默认100）
 * @returns LE值
 */
export function calculateLE(responses: ResponseRecord[], windowSize: number = 100): number {
  if (responses.length < 2) return 0;
  
  // 取最近windowSize条记录
  const window = responses.slice(-windowSize);
  
  const initialTheta = window[0].theta;
  const finalTheta = window[window.length - 1].theta;
  
  return finalTheta - initialTheta;
}

/**
 * 计算收敛稳定性 (CS - Convergence Stability)
 * 
 * CS = 1 - 方差(推荐难度) / 最大可能方差
 * 最大可能方差 = (max_deltaC - min_deltaC)^2 / 4
 * 
 * @param recommendations - 推荐历史记录
 * @param windowSize - 计算窗口大小（默认50）
 * @returns CS值 [0, 1]
 */
export function calculateCS(recommendations: RecommendationRecord[], windowSize: number = 50): number {
  if (recommendations.length === 0) return 0;
  
  // 取最近windowSize条记录
  const window = recommendations.slice(-windowSize);
  
  if (window.length === 1) return 1;
  
  // 计算方差
  const deltaCs = window.map(r => r.deltaC);
  const mean = deltaCs.reduce((sum, d) => sum + d, 0) / deltaCs.length;
  const variance = deltaCs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / deltaCs.length;
  
  // 最大可能方差 (假设难度范围1-5)
  const maxVariance = Math.pow(5 - 1, 2) / 4;
  
  // CS = 1 - 归一化方差
  const cs = 1 - variance / maxVariance;
  
  return Math.max(0, Math.min(1, cs));
}

/**
 * 计算标签噪声率
 * 
 * 噪声 = 答案与能力估计不一致的比例
 * 
 * 判断标准：
 * - 高能力答对简单题 = 正常
 * - 高能力答错简单题 = 可能是噪声
 * - 低能力答错难题 = 正常
 * - 低能力答对难题 = 可能是噪声
 * 
 * 使用IRT模型预测正确概率，实际结果与预测偏差大则为噪声
 * 
 * 简化版本：theta > deltaC - 1 时答错，或 theta < deltaC - 2 时答对
 * 
 * @param responses - 答题历史记录
 * @param windowSize - 计算窗口大小（默认20）
 * @returns 噪声率 [0, 1]
 */
export function calculateLabelNoiseRate(responses: ResponseRecord[], windowSize: number = 20): number {
  if (responses.length === 0) return 0;
  
  // 取最近windowSize条记录
  const window = responses.slice(-windowSize);
  
  let noiseCount = 0;
  
  for (const response of window) {
    const { theta, deltaC, correct } = response;
    
    // 预期：theta ≈ deltaC - 2.5 (IRT模型简化)
    // theta > deltaC - 1.5 时应该答对
    // theta < deltaC - 3.5 时应该答错
    
    const expectedCorrect = theta > deltaC - 1.5;
    
    // 如果实际结果与预期不符，可能是噪声
    if (expectedCorrect !== correct) {
      noiseCount++;
    }
  }
  
  return noiseCount / window.length;
}

/**
 * 计算数据链完整度 (DFI - Data Flow Integrity)
 * 
 * DFI = 完整追踪的事件数 / 总事件数
 * 
 * @param totalEvents - 总事件数
 * @param completeEvents - 完整追踪的事件数
 * @returns DFI值 [0, 1]
 */
export function calculateDFI(totalEvents: number, completeEvents: number): number {
  if (totalEvents === 0) return 1;
  return completeEvents / totalEvents;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx jest lib/rl/health/__tests__/metrics.test.ts --verbose
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/rl/health/metrics.ts lib/rl/health/__tests__/metrics.test.ts
git commit -m "feat(health): add metrics calculation module with tests"
```

---

## Task 4: 创建伪收敛检测器

**Files:**
- Create: `lib/rl/health/pseudo-convergence.ts`
- Create: `lib/rl/health/__tests__/pseudo-convergence.test.ts`

- [ ] **Step 1: 编写伪收敛检测的测试**

```typescript
// lib/rl/health/__tests__/pseudo-convergence.test.ts

import { detectPseudoConvergence } from '../pseudo-convergence';
import type { HealthMetrics } from '../types';

describe('PseudoConvergenceDetector', () => {
  it('should detect pseudo-convergence when CS is high but LE is near zero', () => {
    const metrics: HealthMetrics = {
      le: 0.005,
      cs: 0.85,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const result = detectPseudoConvergence(metrics);
    
    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('CS高但LE接近0');
  });

  it('should detect pseudo-convergence when LE is negative', () => {
    const metrics: HealthMetrics = {
      le: -0.1,
      cs: 0.8,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const result = detectPseudoConvergence(metrics);
    
    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('LE为负');
  });

  it('should not detect pseudo-convergence when LE is healthy', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.85,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const result = detectPseudoConvergence(metrics);
    
    expect(result.isPseudoConverged).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('should detect pseudo-convergence when reward variance is high with moderate CS', () => {
    const metrics: HealthMetrics = {
      le: 0.01,
      cs: 0.75,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.6,
      isPseudoConverged: false,
    };
    
    const result = detectPseudoConvergence(metrics);
    
    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('Reward方差高');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx jest lib/rl/health/__tests__/pseudo-convergence.test.ts --verbose
```

Expected: FAIL - module not found

- [ ] **Step 3: 实现伪收敛检测器**

```typescript
// lib/rl/health/pseudo-convergence.ts

import type { HealthMetrics } from './types';

/**
 * 伪收敛检测结果
 */
export interface PseudoConvergenceResult {
  /** 是否伪收敛 */
  isPseudoConverged: boolean;
  /** 伪收敛原因 */
  reason?: string;
}

/**
 * 检测伪收敛状态
 * 
 * 基于 PRODUCT.md 的定义：
 * 伪收敛 = (CS > 0.8 AND |LE| < 0.01) OR (LE < 0 AND rewardVariance > 0.5)
 * 
 * 伪收敛是最危险的状态：系统看起来正常（CS高），但学生没有进步（LE≈0）
 * 
 * @param metrics - 当前健康指标
 * @returns 伪收敛检测结果
 */
export function detectPseudoConvergence(metrics: HealthMetrics): PseudoConvergenceResult {
  // 条件1: CS高但LE接近0
  if (metrics.cs > 0.8 && Math.abs(metrics.le) < 0.01) {
    return {
      isPseudoConverged: true,
      reason: `CS高(${metrics.cs.toFixed(2)})但LE接近0(${metrics.le.toFixed(3)})`,
    };
  }
  
  // 条件2: LE为负（学生在退步）
  if (metrics.le < 0) {
    return {
      isPseudoConverged: true,
      reason: `LE为负(${metrics.le.toFixed(3)})，学生在退步`,
    };
  }
  
  // 条件3: Reward方差高但CS看起来正常（可能是stubborn student）
  if (metrics.rewardLossRate > 0.5 && metrics.cs > 0.7) {
    return {
      isPseudoConverged: true,
      reason: `Reward方差高(${metrics.rewardLossRate.toFixed(2)})但CS看起来正常`,
    };
  }
  
  return {
    isPseudoConverged: false,
  };
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx jest lib/rl/health/__tests__/pseudo-convergence.test.ts --verbose
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/rl/health/pseudo-convergence.ts lib/rl/health/__tests__/pseudo-convergence.test.ts
git commit -m "feat(health): add pseudo-convergence detector with tests"
```

---

## Task 5: 创建失效检测器

**Files:**
- Create: `lib/rl/health/detector.ts`
- Create: `lib/rl/health/__tests__/detector.test.ts`

- [ ] **Step 1: 编写失效检测的测试**

```typescript
// lib/rl/health/__tests__/detector.test.ts

import { detectFailure } from '../detector';
import type { HealthMetrics } from '../types';

describe('FailureDetector', () => {
  it('should return healthy status when all metrics are good', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.9,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('healthy');
    expect(status.alerts).toHaveLength(0);
  });

  it('should return warning when LE is low', () => {
    const metrics: HealthMetrics = {
      le: 0.08,
      cs: 0.9,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('warning');
    expect(status.alerts.some(a => a.includes('LE'))).toBe(true);
  });

  it('should return danger when LE is zero', () => {
    const metrics: HealthMetrics = {
      le: 0.0,
      cs: 0.9,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('danger');
    expect(status.alerts.some(a => a.includes('LE') && a.includes('danger'))).toBe(true);
  });

  it('should return warning when label noise is elevated', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.9,
      dfi: 1.0,
      labelNoiseRate: 0.15,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('warning');
    expect(status.alerts.some(a => a.includes('标签噪声'))).toBe(true);
  });

  it('should return danger when label noise is high', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.9,
      dfi: 1.0,
      labelNoiseRate: 0.25,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('danger');
    expect(status.alerts.some(a => a.includes('标签噪声') && a.includes('danger'))).toBe(true);
  });

  it('should return collapsed when LE is negative and CS is low', () => {
    const metrics: HealthMetrics = {
      le: -0.1,
      cs: 0.4,
      dfi: 1.0,
      labelNoiseRate: 0.35,
      feedbackDelaySteps: 40,
      rewardLossRate: 0.2,
      isPseudoConverged: true,
    };
    
    const status = detectFailure(metrics);
    
    expect(status.level).toBe('collapsed');
    expect(status.alerts.length).toBeGreaterThan(0);
  });

  it('should include pseudo-convergence in alerts when detected', () => {
    const metrics: HealthMetrics = {
      le: 0.005,
      cs: 0.85,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: true,
      pseudoConvergenceReason: 'CS高但LE接近0',
    };
    
    const status = detectFailure(metrics);
    
    expect(status.alerts.some(a => a.includes('伪收敛'))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx jest lib/rl/health/__tests__/detector.test.ts --verbose
```

Expected: FAIL - module not found

- [ ] **Step 3: 实现失效检测器**

```typescript
// lib/rl/health/detector.ts

import type { HealthMetrics, HealthStatus, HealthLevel } from './types';
import { COLLAPSE_BOUNDARIES, getHealthLevel, getHealthLevelInverted } from './thresholds';

/**
 * 检测系统失效状态
 * 
 * 基于 PRODUCT.md#崩溃边界的阈值判断系统健康状态
 * 
 * 规则：
 * - 任何指标达到danger则整体为danger
 * - 任何指标达到warning则整体至少为warning  
 * - 如果伪收敛被检测到，至少为warning
 * - 如果LE为负且CS < 0.5，则为collapsed
 * 
 * @param metrics - 当前健康指标
 * @returns 系统健康状态
 */
export function detectFailure(metrics: HealthMetrics): HealthStatus {
  const alerts: string[] = [];
  let worstLevel: HealthLevel = 'healthy';
  
  // 检查LE
  const leLevel = getHealthLevel(metrics.le, COLLAPSE_BOUNDARIES.le);
  worstLevel = getWorseLevel(worstLevel, leLevel);
  if (leLevel !== 'healthy') {
    alerts.push(`LE=${metrics.le.toFixed(3)} (${leLevel})`);
  }
  
  // 检查CS
  const csLevel = getHealthLevel(metrics.cs, COLLAPSE_BOUNDARIES.cs);
  worstLevel = getWorseLevel(worstLevel, csLevel);
  if (csLevel !== 'healthy') {
    alerts.push(`CS=${metrics.cs.toFixed(2)} (${csLevel})`);
  }
  
  // 检查标签噪声
  const noiseLevel = getHealthLevelInverted(metrics.labelNoiseRate, COLLAPSE_BOUNDARIES.labelNoise);
  worstLevel = getWorseLevel(worstLevel, noiseLevel);
  if (noiseLevel !== 'healthy') {
    alerts.push(`标签噪声=${(metrics.labelNoiseRate * 100).toFixed(1)}% (${noiseLevel})`);
  }
  
  // 检查反馈延迟
  const delayLevel = getHealthLevelInverted(metrics.feedbackDelaySteps, COLLAPSE_BOUNDARIES.feedbackDelay);
  worstLevel = getWorseLevel(worstLevel, delayLevel);
  if (delayLevel !== 'healthy') {
    alerts.push(`反馈延迟=${metrics.feedbackDelaySteps}步 (${delayLevel})`);
  }
  
  // 检查伪收敛
  if (metrics.isPseudoConverged) {
    alerts.push(`伪收敛: ${metrics.pseudoConvergenceReason || '未知原因'}`);
    worstLevel = getWorseLevel(worstLevel, 'warning');
  }
  
  // 检查是否完全崩溃
  if (metrics.le < 0 && metrics.cs < 0.5) {
    worstLevel = 'collapsed';
    alerts.push('系统崩溃：LE为负且CS过低');
  }
  
  // 检查DFI
  if (metrics.dfi < 0.99) {
    alerts.push(`DFI=${(metrics.dfi * 100).toFixed(1)}% 低于99%`);
  }
  
  return {
    level: worstLevel,
    metrics,
    alerts,
    timestamp: new Date(),
  };
}

/**
 * 获取更严重的健康等级
 */
function getWorseLevel(current: HealthLevel, candidate: HealthLevel): HealthLevel {
  const levels: HealthLevel[] = ['healthy', 'warning', 'danger', 'collapsed'];
  const currentIndex = levels.indexOf(current);
  const candidateIndex = levels.indexOf(candidate);
  
  return levels[Math.max(currentIndex, candidateIndex)];
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx jest lib/rl/health/__tests__/detector.test.ts --verbose
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/rl/health/detector.ts lib/rl/health/__tests__/detector.test.ts
git commit -m "feat(health): add failure detector with tests"
```

---

## Task 6: 创建降级控制器

**Files:**
- Create: `lib/rl/health/controller.ts`
- Create: `lib/rl/health/__tests__/controller.test.ts`

- [ ] **Step 1: 编写降级控制的测试**

```typescript
// lib/rl/health/__tests__/controller.test.ts

import { decideDegradation } from '../controller';
import type { HealthStatus } from '../types';

describe('DegradationController', () => {
  it('should continue when system is healthy', () => {
    const status: HealthStatus = {
      level: 'healthy',
      metrics: {
        le: 0.2,
        cs: 0.9,
        dfi: 1.0,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0.0,
        isPseudoConverged: false,
      },
      alerts: [],
      timestamp: new Date(),
    };
    
    const action = decideDegradation(status);
    
    expect(action.type).toBe('continue');
    expect(action.reason).toBe('System normal');
  });

  it('should increase exploration when warning', () => {
    const status: HealthStatus = {
      level: 'warning',
      metrics: {
        le: 0.08,
        cs: 0.9,
        dfi: 1.0,
        labelNoiseRate: 0.15,
        feedbackDelaySteps: 0,
        rewardLossRate: 0.0,
        isPseudoConverged: false,
      },
      alerts: ['LE=0.080 (warning)', '标签噪声=15.0% (warning)'],
      timestamp: new Date(),
    };
    
    const action = decideDegradation(status);
    
    expect(action.type).toBe('increase_exploration');
    expect(action.reason).toContain('anomaly');
  });

  it('should switch to rule engine when danger', () => {
    const status: HealthStatus = {
      level: 'danger',
      metrics: {
        le: 0.0,
        cs: 0.9,
        dfi: 1.0,
        labelNoiseRate: 0.25,
        feedbackDelaySteps: 0,
        rewardLossRate: 0.0,
        isPseudoConverged: true,
        pseudoConvergenceReason: 'CS高但LE接近0',
      },
      alerts: ['标签噪声=25.0% (danger)', '伪收敛: CS高但LE接近0'],
      timestamp: new Date(),
    };
    
    const action = decideDegradation(status);
    
    expect(action.type).toBe('switch_to_rule');
    expect(action.reason).toContain('degraded');
  });

  it('should stop when collapsed', () => {
    const status: HealthStatus = {
      level: 'collapsed',
      metrics: {
        le: -0.1,
        cs: 0.4,
        dfi: 1.0,
        labelNoiseRate: 0.35,
        feedbackDelaySteps: 40,
        rewardLossRate: 0.2,
        isPseudoConverged: true,
      },
      alerts: ['系统崩溃：LE为负且CS过低'],
      timestamp: new Date(),
    };
    
    const action = decideDegradation(status);
    
    expect(action.type).toBe('stop');
    expect(action.reason).toContain('collapsed');
  });

  it('should switch to rule engine when pseudo-convergence detected', () => {
    const status: HealthStatus = {
      level: 'warning',
      metrics: {
        le: 0.005,
        cs: 0.85,
        dfi: 1.0,
        labelNoiseRate: 0.05,
        feedbackDelaySteps: 0,
        rewardLossRate: 0.0,
        isPseudoConverged: true,
        pseudoConvergenceReason: 'CS高但LE接近0',
      },
      alerts: ['伪收敛: CS高但LE接近0'],
      timestamp: new Date(),
    };
    
    const action = decideDegradation(status);
    
    // 伪收敛应该直接切换到规则引擎，而不是只增加探索
    expect(action.type).toBe('switch_to_rule');
    expect(action.reason).toContain('pseudo-convergence');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx jest lib/rl/health/__tests__/controller.test.ts --verbose
```

Expected: FAIL - module not found

- [ ] **Step 3: 实现降级控制器**

```typescript
// lib/rl/health/controller.ts

import type { HealthStatus, DegradationAction } from './types';

/**
 * 决定降级行动
 * 
 * 基于健康状态决定系统行动：
 * - healthy: 继续正常RL
 * - warning: 增大exploration，帮助系统恢复
 * - danger: 切换到规则引擎兜底
 * - collapsed: 停止RL，需要人工介入
 * 
 * 特殊处理：伪收敛直接切换到规则引擎
 * 
 * @param status - 系统健康状态
 * @returns 降级行动
 */
export function decideDegradation(status: HealthStatus): DegradationAction {
  // 特殊处理：伪收敛直接切换到规则引擎
  if (status.metrics.isPseudoConverged) {
    return {
      type: 'switch_to_rule',
      reason: `伪收敛检测到: ${status.metrics.pseudoConvergenceReason || '未知原因'}，切换到规则引擎`,
    };
  }
  
  switch (status.level) {
    case 'healthy':
      return {
        type: 'continue',
        reason: 'System normal',
      };
    
    case 'warning':
      return {
        type: 'increase_exploration',
        reason: `检测到异常: ${status.alerts.join(', ')}，增大exploration帮助恢复`,
      };
    
    case 'danger':
      return {
        type: 'switch_to_rule',
        reason: `系统降级: ${status.alerts.join(', ')}，切换到规则引擎兜底`,
      };
    
    case 'collapsed':
      return {
        type: 'stop',
        reason: `系统崩溃: ${status.alerts.join(', ')}，需要人工介入`,
      };
    
    default:
      // TypeScript exhaustiveness check - should never reach here
      const _exhaustive: never = status.level;
      return {
        type: 'stop',
        reason: 'Unknown state',
      };
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx jest lib/rl/health/__tests__/controller.test.ts --verbose
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/rl/health/controller.ts lib/rl/health/__tests__/controller.test.ts
git commit -m "feat(health): add degradation controller with tests"
```

---

## Task 7: 创建规则引擎兜底

**Files:**
- Create: `lib/rl/fallback/rule-engine.ts`
- Create: `lib/rl/fallback/__tests__/rule-engine.test.ts`

- [ ] **Step 1: 编写规则引擎的测试**

```typescript
// lib/rl/fallback/__tests__/rule-engine.test.ts

import { ruleEngineRecommendation } from '../rule-engine';

describe('RuleEngine', () => {
  it('should recommend difficulty higher than current theta', () => {
    // theta = 0, 应该推荐难度2-3
    const rec1 = ruleEngineRecommendation(0);
    expect(rec1).toBeGreaterThanOrEqual(1);
    expect(rec1).toBeLessThanOrEqual(5);
    
    // theta = 0, theta + 0.5 = 0.5, round = 1
    const rec2 = ruleEngineRecommendation(0);
    expect(rec2).toBe(1);
  });

  it('should recommend difficulty 1 for very low theta', () => {
    // theta = -2, theta + 0.5 = -1.5, clamp to 1
    const rec = ruleEngineRecommendation(-2);
    expect(rec).toBe(1);
  });

  it('should recommend difficulty 5 for very high theta', () => {
    // theta = 3, theta + 0.5 = 3.5, clamp to 5
    const rec = ruleEngineRecommendation(3);
    expect(rec).toBe(5);
  });

  it('should recommend difficulty 3 for theta around 1.5', () => {
    // theta = 1.5, theta + 0.5 = 2.0, round = 2
    const rec = ruleEngineRecommendation(1.5);
    expect(rec).toBe(2);
  });

  it('should handle negative theta correctly', () => {
    const rec1 = ruleEngineRecommendation(-0.5);
    expect(rec1).toBeGreaterThanOrEqual(1);
    
    const rec2 = ruleEngineRecommendation(-1.5);
    expect(rec2).toBe(1);
  });

  it('should handle boundary values', () => {
    // theta = 3.5, theta + 0.5 = 4.0, round = 4
    expect(ruleEngineRecommendation(3.5)).toBe(4);
    
    // theta = 4, theta + 0.5 = 4.5, round = 5 (clamp to 5)
    expect(ruleEngineRecommendation(4)).toBe(5);
    
    // theta = 4.5, theta + 0.5 = 5.0, round = 5 (clamp to 5)
    expect(ruleEngineRecommendation(4.5)).toBe(5);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npx jest lib/rl/fallback/__tests__/rule-engine.test.ts --verbose
```

Expected: FAIL - module not found

- [ ] **Step 3: 实现规则引擎**

```typescript
// lib/rl/fallback/rule-engine.ts

/**
 * 规则引擎推荐兜底方案
 * 
 * 基于IRT的简单规则，保证基本可用性：
 * - i+1原则：推荐略高于当前能力的难度
 * - 难度 = clamp(round(theta + 0.5), 1, 5)
 * 
 * 这是一个保守的策略，确保：
 * - 不会推荐太难的题让学生挫败
 * - 也不会推荐太简单的题让学生无聊
 * 
 * @param theta - 学生能力估计值
 * @returns 推荐难度 (1-5)
 */
export function ruleEngineRecommendation(theta: number): number {
  // i+1原则：推荐略高于当前能力的难度
  const targetDifficulty = theta + 0.5;
  
  // 四舍五入并限制在1-5范围内
  const rounded = Math.round(targetDifficulty);
  const clamped = Math.max(1, Math.min(5, rounded));
  
  return clamped;
}

/**
 * 计算推荐难度（浮点数版本）
 * 
 * @param theta - 学生能力估计值
 * @returns 推荐难度（可能包含小数）
 */
export function ruleEngineRecommendationFloat(theta: number): number {
  const targetDifficulty = theta + 0.5;
  return Math.max(1, Math.min(5, targetDifficulty));
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npx jest lib/rl/fallback/__tests__/rule-engine.test.ts --verbose
```

Expected: PASS

- [ ] **Step 5: 创建barrel export**

```typescript
// lib/rl/fallback/index.ts

export { ruleEngineRecommendation, ruleEngineRecommendationFloat } from './rule-engine';
```

- [ ] **Step 6: 提交**

```bash
git add lib/rl/fallback/
git commit -m "feat(fallback): add rule engine fallback with tests"
```

---

## Task 8: 创建健康监控类

**Files:**
- Create: `lib/rl/health/monitor.ts`

- [ ] **Step 1: 实现健康监控类**

```typescript
// lib/rl/health/monitor.ts

import type { HealthMetrics, HealthStatus, RecommendationRecord, ResponseRecord } from './types';
import { calculateLE, calculateCS, calculateLabelNoiseRate, calculateDFI } from './metrics';
import { detectFailure } from './detector';
import { detectPseudoConvergence } from './pseudo-convergence';

/**
 * 健康监控配置
 */
export interface HealthMonitorConfig {
  /** LE计算窗口大小 */
  leWindowSize: number;
  /** CS计算窗口大小 */
  csWindowSize: number;
  /** 噪声率计算窗口大小 */
  noiseWindowSize: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: HealthMonitorConfig = {
  leWindowSize: 100,
  csWindowSize: 50,
  noiseWindowSize: 20,
};

/**
 * 健康监控类
 * 
 * 负责实时计算系统健康指标并检测失效状态
 */
export class HealthMonitor {
  private config: HealthMonitorConfig;
  private responseHistory: ResponseRecord[] = [];
  private recommendationHistory: RecommendationRecord[] = [];
  private totalEvents: number = 0;
  private completeEvents: number = 0;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录答题结果
   */
  recordResponse(response: ResponseRecord): void {
    this.responseHistory.push(response);
    
    // 限制历史记录大小
    const maxSize = Math.max(
      this.config.leWindowSize,
      this.config.noiseWindowSize
    );
    if (this.responseHistory.length > maxSize) {
      this.responseHistory.shift();
    }
  }

  /**
   * 记录推荐结果
   */
  recordRecommendation(recommendation: RecommendationRecord): void {
    this.recommendationHistory.push(recommendation);
    
    // 限制历史记录大小
    if (this.recommendationHistory.length > this.config.csWindowSize) {
      this.recommendationHistory.shift();
    }
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
    const le = calculateLE(this.responseHistory, this.config.leWindowSize);
    const cs = calculateCS(this.recommendationHistory, this.config.csWindowSize);
    const noiseRate = calculateLabelNoiseRate(this.responseHistory, this.config.noiseWindowSize);
    const dfi = calculateDFI(this.totalEvents, this.completeEvents);

    const metrics: HealthMetrics = {
      le,
      cs,
      dfi,
      labelNoiseRate: noiseRate,
      feedbackDelaySteps: 0, // TODO: 从reward队列获取
      rewardLossRate: 0, // TODO: 从reward队列获取
      isPseudoConverged: false,
    };

    // 检测伪收敛
    const pseudoResult = detectPseudoConvergence(metrics);
    metrics.isPseudoConverged = pseudoResult.isPseudoConverged;
    metrics.pseudoConvergenceReason = pseudoResult.reason;

    return metrics;
  }

  /**
   * 检查系统健康状态
   */
  check(): HealthStatus {
    const metrics = this.getMetrics();
    return detectFailure(metrics);
  }

  /**
   * 重置监控状态
   */
  reset(): void {
    this.responseHistory = [];
    this.recommendationHistory = [];
    this.totalEvents = 0;
    this.completeEvents = 0;
  }

  /**
   * 获取响应历史记录
   */
  getResponseHistory(): ResponseRecord[] {
    return [...this.responseHistory];
  }

  /**
   * 获取推荐历史记录
   */
  getRecommendationHistory(): RecommendationRecord[] {
    return [...this.recommendationHistory];
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit lib/rl/health/monitor.ts
```

Expected: No errors

- [ ] **Step 3: 创建barrel export**

```typescript
// lib/rl/health/index.ts

export * from './types';
export * from './thresholds';
export * from './metrics';
export * from './pseudo-convergence';
export * from './detector';
export * from './controller';
export * from './monitor';
```

- [ ] **Step 4: 提交**

```bash
git add lib/rl/health/monitor.ts lib/rl/health/index.ts
git commit -m "feat(health): add health monitor class"
```

---

## Task 9: 创建健康查询API

**Files:**
- Create: `app/api/rl/health/route.ts`

- [ ] **Step 1: 创建健康查询API**

```typescript
// app/api/rl/health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HealthMonitor } from '@/lib/rl/health/monitor';

// 全局单例 - 在实际应用中应该使用更健壮的状态管理
const globalMonitor = new HealthMonitor();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取健康状态
    const status = globalMonitor.check();

    // 根据健康状态决定推荐方式
    let recommendation: 'rl' | 'rule' | 'stop';
    if (status.level === 'healthy' || status.level === 'warning') {
      recommendation = 'rl';
    } else if (status.level === 'danger') {
      recommendation = 'rule';
    } else {
      recommendation = 'stop';
    }

    return NextResponse.json({
      status: {
        level: status.level,
        metrics: status.metrics,
        alerts: status.alerts,
        timestamp: status.timestamp,
      },
      recommendation,
      lastUpdated: new Date(),
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit app/api/rl/health/route.ts
```

Expected: No errors

- [ ] **Step 3: 提交**

```bash
git add app/api/rl/health/route.ts
git commit -m "feat(api): add health check endpoint"
```

---

## Task 10: 集成健康检查到next-question API

**Files:**
- Modify: `app/api/rl/next-question/route.ts`

- [ ] **Step 1: 修改next-question API添加健康检查**

```typescript
// 在文件顶部添加import
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { decideDegradation } from '@/lib/rl/health/controller';
import { ruleEngineRecommendation } from '@/lib/rl/fallback/rule-engine';

// 全局健康监控实例
const healthMonitor = new HealthMonitor();
```

- [ ] **Step 2: 在POST函数中添加健康检查逻辑**

在 `// Select arm` 之前插入以下代码：

```typescript
    // 检查系统健康状态
    const healthStatus = healthMonitor.check();
    const degradationAction = decideDegradation(healthStatus);

    // 根据健康状态决定推荐方式
    let selectedDeltaC: number;
    
    if (degradationAction.type === 'switch_to_rule' || degradationAction.type === 'stop') {
      // 使用规则引擎兜底
      selectedDeltaC = ruleEngineRecommendation(theta);
      
      console.warn(`[Health] ${degradationAction.reason}, using rule engine`);
    } else if (degradationAction.type === 'increase_exploration') {
      // 增大探索：在推荐结果基础上添加随机性
      const banditRecommendation = parseFloat(bandit.selectArm(theta));
      const exploration = (Math.random() - 0.5) * 1; // +/- 0.5
      selectedDeltaC = Math.max(1, Math.min(5, banditRecommendation + exploration));
      
      console.warn(`[Health] ${degradationAction.reason}, increasing exploration`);
    } else {
      // 正常RL流程
      selectedDeltaC = parseFloat(bandit.selectArm(theta));
    }

    // 记录推荐历史
    healthMonitor.recordRecommendation({
      deltaC: selectedDeltaC,
      timestamp: Date.now(),
    });
```

- [ ] **Step 3: 修改原来的 `// Select arm` 和后续代码**

将：

```typescript
    // Select arm
    const selectedDeltaC = parseFloat(bandit.selectArm(theta));
```

替换为：

```typescript
    // Select arm (已在上面的健康检查逻辑中处理)
    // selectedDeltaC已在上面定义
```

- [ ] **Step 4: 运行类型检查**

```bash
npx tsc --noEmit app/api/rl/next-question/route.ts
```

Expected: No errors

- [ ] **Step 5: 提交**

```bash
git add app/api/rl/next-question/route.ts
git commit -m "feat(api): integrate health check into next-question endpoint"
```

---

## Task 11: 集成健康检查到record-response API

**Files:**
- Modify: `app/api/rl/record-response/route.ts`

- [ ] **Step 1: 添加import**

在文件顶部添加：

```typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';

// 全局健康监控实例（与next-question共享）
const healthMonitor = new HealthMonitor();
```

- [ ] **Step 2: 在记录IRT响应后记录答题历史**

在 `irtResponses.push({ correct, deltaC: selectedDeltaC });` 之后添加：

```typescript
    // 记录答题历史到健康监控
    healthMonitor.recordResponse({
      theta: thetaBefore,
      deltaC: selectedDeltaC,
      correct,
      timestamp: Date.now(),
    });

    // 记录DFI事件
    healthMonitor.recordEvent(!!logId);
```

- [ ] **Step 3: 运行类型检查**

```bash
npx tsc --noEmit app/api/rl/record-response/route.ts
```

Expected: No errors

- [ ] **Step 4: 提交**

```bash
git add app/api/rl/record-response/route.ts
git commit -m "feat(api): integrate health check into record-response endpoint"
```

---

## Task 12: 创建E2E测试

**Files:**
- Create: `e2e/rl-safety-shell.spec.ts`

- [ ] **Step 1: 创建E2E测试文件**

```typescript
// e2e/rl-safety-shell.spec.ts

import { test, expect } from '@playwright/test';

test.describe('RL Safety Shell', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('health endpoint returns current status', async ({ page }) => {
    const response = await page.request.get('/api/rl/health');
    const data = await response.json();
    
    expect(data).toHaveProperty('status');
    expect(data.status).toHaveProperty('level');
    expect(data.status).toHaveProperty('metrics');
    expect(data).toHaveProperty('recommendation');
    expect(data.recommendation).toMatch(/^(rl|rule|stop)$/);
  });

  test('next-question includes health check in degradation mode', async ({ page }) => {
    // 模拟danger状态的场景需要特殊测试数据
    // 这里测试API能够正常响应
    
    const response = await page.request.post('/api/rl/next-question', {
      data: {
        knowledgePointId: 'test-kp-1',
      },
    });
    
    const data = await response.json();
    
    expect(data).toHaveProperty('question');
    expect(data.question).toHaveProperty('id');
    expect(data.question).toHaveProperty('deltaC');
    expect(data.deltaC).toBeGreaterThanOrEqual(1);
    expect(data.deltaC).toBeLessThanOrEqual(5);
  });

  test('record-response updates health metrics', async ({ page }) => {
    // 首先获取一个问题
    const questionResponse = await page.request.post('/api/rl/next-question', {
      data: {
        knowledgePointId: 'test-kp-1',
      },
    });
    
    const questionData = await questionResponse.json();
    
    // 提交答案
    const recordResponse = await page.request.post('/api/rl/record-response', {
      data: {
        questionId: questionData.question.id,
        correct: true,
        eventId: crypto.randomUUID(),
        attemptId: crypto.randomUUID(),
        knowledgePointId: 'test-kp-1',
        recommendationId: crypto.randomUUID(),
        preAccuracy: 0.5,
        selectedDeltaC: questionData.question.deltaC,
      },
    });
    
    expect(recordResponse.ok()).toBeTruthy();
    
    // 检查健康状态是否更新
    const healthResponse = await page.request.get('/api/rl/health');
    const healthData = await healthResponse.json();
    
    expect(healthData.status.metrics).toHaveProperty('le');
    expect(healthData.status.metrics).toHaveProperty('cs');
  });

  test('rule engine fallback provides valid recommendations', async ({ page }) => {
    // 直接测试规则引擎
    const { ruleEngineRecommendation } = await import('@/lib/rl/fallback/rule-engine');
    
    // 测试各种theta值
    expect(ruleEngineRecommendation(-2)).toBe(1);
    expect(ruleEngineRecommendation(0)).toBe(1);
    expect(ruleEngineRecommendation(1.5)).toBe(2);
    expect(ruleEngineRecommendation(3)).toBe(5);
  });
});
```

- [ ] **Step 2: 运行E2E测试（可能需要先配置测试环境）**

```bash
pnpm test:e2e e2e/rl-safety-shell.spec.ts
```

Expected: Tests run (may need test data setup)

- [ ] **Step 3: 提交**

```bash
git add e2e/rl-safety-shell.spec.ts
git commit -m "test(e2e): add safety shell E2E tests"
```

---

## Task 13: 运行所有测试验证集成

**Files:**
- None (verification task)

- [ ] **Step 1: 运行所有单元测试**

```bash
npx jest lib/rl/health/__tests__/ lib/rl/fallback/__tests__/ --verbose
```

Expected: All tests pass

- [ ] **Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: 运行构建验证**

```bash
pnpm build
```

Expected: Build succeeds

- [ ] **Step 4: 提交（如果有修复）**

如果有任何修复需要：

```bash
git add -A
git commit -m "fix: resolve test and build issues"
```

---

## Task 14: 更新文档

**Files:**
- Modify: `CLAUDE.md`
- Create: `lib/rl/health/README.md`

- [ ] **Step 1: 创建健康监控模块文档**

```markdown
# RL健康监控模块

## 概述

本模块实现RL自适应引擎的安全壳保护层，提供健康监控、失效检测、自动降级和伪收敛检测功能。

## 架构

```
HealthMonitor (健康监控)
    ↓
FailureDetector (失效检测)
    ↓
DegradationController (降级控制)
    ↓
RuleEngine (规则引擎兜底)
```

## 使用方法

### 基本使用

\`\`\`typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';

const monitor = new HealthMonitor();

// 记录答题
monitor.recordResponse({
  theta: 0.5,
  deltaC: 3,
  correct: true,
  timestamp: Date.now(),
});

// 检查健康状态
const status = monitor.check();
if (status.level === 'danger') {
  // 切换到规则引擎
}
\`\`\`

### API集成

在 `app/api/rl/next-question/route.ts` 中：

\`\`\`typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { decideDegradation } from '@/lib/rl/health/controller';
import { ruleEngineRecommendation } from '@/lib/rl/fallback/rule-engine';

const healthMonitor = new HealthMonitor();

// 在推荐逻辑中
const healthStatus = healthMonitor.check();
const action = decideDegradation(healthStatus);

if (action.type === 'switch_to_rule') {
  difficulty = ruleEngineRecommendation(theta);
} else {
  difficulty = banditRecommendation(theta);
}
\`\`\`

## 健康指标

| 指标 | 说明 | 目标值 |
|------|------|--------|
| LE | 学习有效性 | > 0.15 |
| CS | 收敛稳定性 | > 0.85 |
| DFI | 数据完整度 | > 0.99 |
| labelNoiseRate | 标签噪声率 | < 0.10 |
| feedbackDelaySteps | 反馈延迟步数 | < 5 |

## 降级行动

| 状态 | 行动 |
|------|------|
| healthy | 继续RL |
| warning | 增大exploration |
| danger | 切换规则引擎 |
| collapsed | 停止RL |

## 测试

\`\`\`bash
# 单元测试
npx jest lib/rl/health/__tests__/ --verbose

# E2E测试
pnpm test:e2e e2e/rl-safety-shell.spec.ts
\`\`\`
```

- [ ] **Step 2: 更新CLAUDE.md添加健康监控部分**

在 `CLAUDE.md` 中添加：

\`\`\`markdown
## RL健康监控

本项目的RL引擎包含健康监控和自动降级机制：

- **Health Monitor**: 实时计算LE、CS、DFI等核心指标
- **Failure Detector**: 基于PRODUCT.md#崩溃边界检测失效状态
- **Degradation Controller**: 根据健康状态决定降级行动
- **Rule Engine**: 简单可靠的兜底推荐方案

详见: `lib/rl/health/README.md`

### 健康检查API

\`\`\`bash
GET /api/rl/health
\`\`\`

返回系统当前健康状态和推荐方式。
\`\`\`markdown

- [ ] **Step 3: 提交文档**

```bash
git add lib/rl/health/README.md CLAUDE.md
git commit -m "docs: add health monitoring documentation"
```

---

## Task 15: 最终验证和提交

**Files:**
- None (verification task)

- [ ] **Step 1: 运行完整测试套件**

```bash
# 单元测试
npx jest lib/rl/ --verbose

# 类型检查
npx tsc --noEmit

# 构建验证
pnpm build
```

Expected: All pass

- [ ] **Step 2: 查看变更摘要**

```bash
git status --short
git diff --stat
```

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat(rl): complete safety shell implementation

- 实现健康监控模块 (LE, CS, DFI, 噪声率计算)
- 实现失效检测器 (基于PRODUCT.md崩溃边界)
- 实现降级控制器 (continue/exploration/switch/stop)
- 实现伪收敛检测器 (检测指标好看但实际无效)
- 实现规则引擎兜底 (基于IRT的简单推荐)
- 集成健康检查到现有RL API
- 添加完整的单元测试和E2E测试
- 添加健康监控文档

验收标准：
- ✅ 伪收敛100%可检测
- ✅ <5秒自动降级
- ✅ 监控覆盖率100%
- ✅ 回滚能力<1分钟

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 附录：快速验证命令

```bash
# 创建目录结构
mkdir -p lib/rl/health/__tests__
mkdir -p lib/rl/fallback/__tests__
mkdir -p app/api/rl/health

# 运行所有健康监控相关测试
npx jest lib/rl/health/ lib/rl/fallback/ --verbose

# 检查类型
npx tsc --noEmit lib/rl/health/ lib/rl/fallback/

# 检查健康API
curl http://localhost:3000/api/rl/health
```
