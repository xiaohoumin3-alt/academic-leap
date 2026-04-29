# RL自适应引擎核心加固设计

**日期**: 2026-04-30
**状态**: 待审核
**版本**: v1.0
**前序**: [RL安全壳设计](./2026-04-29-rl-safety-shell-design.md)

---

## 1. 背景与目标

### 1.1 前置工作回顾

Phase 1（安全壳）已完成：
- ✅ Health Monitor - 实时健康指标监控
- ✅ Failure Detector - 基于阈值的失效检测
- ✅ Degradation Controller - 自动降级控制
- ✅ Rule Engine Fallback - 规则引擎兜底

### 1.2 Phase 2 目标

在安全壳保护下，加固核心 RL 算法本身：

| 组件 | 问题 | 解决方案 | 预期收益 |
|------|------|----------|----------|
| Thompson Sampling | 低置信度臂仍被采样 | 置信度加权采样 | LE +5-10% |
| Credit Assignment | 延迟反馈导致归因错误 | 时间衰减权重 | LE +5-8% |
| 分布漂移 | 策略随时间失效 | 分布监控 + 重校准 | CS +10% |

### 1.3 约束条件

- **时间**: 2-3周
- **风险**: 中等（有安全壳保护）
- **兼容性**: 不破坏现有 API
- **回滚**: 每个组件可独立禁用

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing RL Engine                           │
│  (Thompson Sampling + IRT + Bandit)                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│  CW-TS Layer │ │ TD-CA    │ │ Distribution│
│  (采样增强)   │ │ (奖励修正)│ │ Monitor     │
└──────────────┘ └──────────┘ └─────────────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
              安全壳保护（Phase 1）
```

### 2.2 方案选择：渐进式加固（方案 A）

**设计原则**：
1. **非侵入式**: 在现有组件上添加层，不修改核心逻辑
2. **可独立降级**: 每个组件可单独禁用
3. **渐进式交付**: 可分阶段发布

**优点**：
- 风险低、可快速回滚
- 每个模块可独立测试
- 符合"2/8原则"

---

## 3. 组件设计

### 3.1 Confidence-Weighted Thompson Sampling (CW-TS)

**文件**: `lib/rl/bandit/cw-thompson-sampling.ts`

**职责**: 根据臂的置信度调整采样权重，减少低置信度臂的选中概率

**核心原理**：
```typescript
// 置信度 = 采样次数的函数
confidence = 1 - exp(-pullCount / confidenceScale)

// 加权采样
weightedSample = betaSample * confidenceWeight(confidence)
```

**接口设计**：
```typescript
interface CWTSConfig {
  confidenceScale: number;      // 置信度增长速度
  minConfidence: number;        // 最小置信度权重
  enableCutoff: boolean;        // 是否启用低置信度切断
  cutoffThreshold: number;      // 切断阈值
}

interface CWTSBanditState extends BanditState {
  confidenceWeights: Map<string, number>;
}
```

**算法**：
1. 对每个臂计算置信度权重
2. Beta 采样后乘以置信度权重
3. 选择加权后的最大值
4. 可选：低于阈值直接跳过

**测试要求**：
- 高置信度臂选中率 > 80%
- 低置信度臂选中率 < 20%
- 置信度增长正确性

---

### 3.2 Time-Decay Credit Assignment (TD-CA)

**文件**: `lib/rl/reward/time-decay-credit.ts`

**职责**: 对延迟反馈按时间衰减权重，修正 credit assignment

**核心原理**：
```typescript
// 时间衰减函数
decayWeight = exp(-delayMs / decayHalfLife)

// 衰减后的 reward
decayedReward = baseReward * decayWeight
```

**接口设计**：
```typescript
interface TimeDecayConfig {
  decayHalfLife: number;        // 半衰期（毫秒）
  maxDelay: number;             // 最大延迟（超过则忽略）
  minWeight: number;            // 最小权重
}

interface DecayResult {
  adjustedReward: number;
  originalReward: number;
  decayWeight: number;
  delayMs: number;
  isIgnored: boolean;           // 延迟过长被忽略
}
```

**场景覆盖**：
| 场景 | 延迟范围 | 衰减策略 |
|------|----------|----------|
| 即时反馈 | < 1分钟 | 无衰减 (weight = 1.0) |
| 短暂离场 | 1-30分钟 | 线性衰减 |
| 跨 session | 30分钟-2小时 | 指数衰减 |
| 过长延迟 | > 2小时 | 忽略 (isIgnored = true) |

**集成点**：
```typescript
// 在 calculateLEReward 之后
const baseReward = await calculateLEReward(response, context, historyService);
const decayed = applyTimeDecay(baseReward.reward, response.timestamp, config);
return { ...baseReward, reward: decayed.adjustedReward };
```

**测试要求**：
- 1分钟内衰减 < 5%
- 30分钟衰减 40-60%
- 2小时衰减 > 90%
- maxDelay 后返回 isIgnored = true

---

### 3.3 Distribution Monitor (DistMon)

**文件**: `lib/rl/monitor/distribution.ts`

**职责**: 监控三类分布偏移，触发告警和重校准

#### 3.3.1 题目难度漂移监控

**方法**: IRT 参数变化检测
```typescript
interface DifficultyDrift {
  questionId: string;
  oldDifficulty: number;
  newDifficulty: number;
  driftAmount: number;
  significance: 'insignificant' | 'moderate' | 'significant';
}

function detectDifficultyDrift(
  history: QuestionHistory[],
  windowSize: number = 100
): DifficultyDrift[]
```

**检测逻辑**：
- 滚动窗口计算 IRT 难度估计
- 与初始难度比较
- 漂移 > 0.3 → significant

#### 3.3.2 学生能力漂移监控

**方法**: Theta 分布统计检验
```typescript
interface AbilityDrift {
  timestamp: Date;
  oldMean: number;
  newMean: number;
  oldStd: number;
  newStd: number;
  ksTestPValue: number;  // Kolmogorov-Smirnov 检验
}

function detectAbilityDrift(
  thetaHistory: number[],
  windowSize: number = 200
): AbilityDrift | null
```

**检测逻辑**：
- 滚动窗口计算 theta 均值/标准差
- KS 检验比较分布
- p < 0.05 → 显著漂移

#### 3.3.3 奖励分布漂移监控

**方法**: Reward 统计变化
```typescript
interface RewardDrift {
  timestamp: Date;
  oldMean: number;
  newMean: number;
  changePercent: number;
  isSignificant: boolean;
}

function detectRewardDrift(
  rewardHistory: number[],
  windowSize: number = 50
): RewardDrift | null
```

**检测逻辑**：
- 滚动窗口计算 reward 均值
- 变化 > 20% → 显著漂移

#### 3.3.4 综合告警

```typescript
interface DistributionAlert {
  type: 'difficulty' | 'ability' | 'reward';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation: 'continue' | 'recalibrate' | 'reset';
  timestamp: Date;
}

class DistributionMonitor {
  check(metrics: HealthMetrics): DistributionAlert[];
  recalibrate(): RecalibrationResult;
}
```

**测试要求**：
- 题目难度漂移检测率 > 90%
- 学生能力漂移 KS 检验正确
- 奖励漂移 > 20% 触发告警

---

## 4. API 集成

### 4.1 修改现有 API

**文件**: `app/api/rl/next-question/route.ts`

```typescript
// 启用 CW-TS
import { CWThompsonSamplingBandit } from '@/lib/rl/bandit/cw-thompson-sampling';

const bandit = new CWThompsonSamplingBandit({
  confidenceScale: 100,
  minConfidence: 0.3,
  enableCutoff: false
});

const arm = bandit.selectArm(ability);
```

**文件**: `app/api/rl/record-response/route.ts`

```typescript
// 启用 TD-CA
import { applyTimeDecay } from '@/lib/rl/reward/time-decay-credit';

const baseReward = await calculateLEReward(...);
const decayed = applyTimeDecay(baseReward.reward, response.timestamp);
await bandit.update(arm.deltaC, decayed.adjustedReward > 0.5);
```

### 4.2 新增 API

**端点**: `POST /api/rl/recalibrate`

```typescript
interface RecalibrateRequest {
  reason: 'distribution_drift' | 'manual';
  scope: 'full' | 'partial';
}

interface RecalibrateResponse {
  success: boolean;
  changes: {
    questionsRecalibrated: number;
    banditReset: boolean;
  };
}
```

---

## 5. 配置管理

### 5.1 特性开关

```typescript
// lib/rl/config/features.ts
export const PHASE_2_FEATURES = {
  cwts: {
    enabled: true,
    config: {
      confidenceScale: 100,
      minConfidence: 0.3,
      enableCutoff: false
    }
  },
  tdca: {
    enabled: true,
    config: {
      decayHalfLife: 30 * 60 * 1000,  // 30分钟
      maxDelay: 2 * 60 * 60 * 1000,   // 2小时
      minWeight: 0.1
    }
  },
  distmon: {
    enabled: true,
    config: {
      checkInterval: 100,  // 每100次请求检查一次
      alertThreshold: 0.2
    }
  }
};
```

### 5.2 环境变量

```bash
# Phase 2 Feature Flags
RL_CWTS_ENABLED=true
RL_TDCA_ENABLED=true
RL_DISTMON_ENABLED=true

# CW-TS Configuration
RL_CWTS_CONFIDENCE_SCALE=100
RL_CWTS_MIN_CONFIDENCE=0.3

# TD-CA Configuration
RL_TDCA_DECAY_HALFLIFE=1800000  # 30分钟 (毫秒)
RL_TDCA_MAX_DELAY=7200000       # 2小时 (毫秒)

# Distribution Monitor Configuration
RL_DISTMON_CHECK_INTERVAL=100
RL_DISTMON_ALERT_THRESHOLD=0.2
```

---

## 6. 测试策略

### 6.1 单元测试

| 组件 | 测试内容 | 目标覆盖率 |
|------|---------|-----------|
| CW-TS | 置信度计算、加权采样、边界条件 | 90%+ |
| TD-CA | 衰减函数、边界条件、忽略逻辑 | 90%+ |
| DistMon | 三类漂移检测、告警触发 | 85%+ |

### 6.2 集成测试

| 场景 | 验证内容 |
|------|---------|
| CW-TS + Bandit | 高置信度臂优先选中 |
| TD-CA + Reward | 延迟反馈正确衰减 |
| DistMon + 告警 | 漂移检测触发告警 |

### 6.3 回归测试

运行 Phase 1 的所有测试，确保：
- 79 个测试全部通过
- LE、CS、DFI 指标不降低
- 安全壳功能正常

### 6.4 性能测试

| 指标 | 目标 |
|------|------|
| API 响应时间 | < 100ms (P95) |
| 内存增加 | < 20MB |
| CPU 开销 | < 5% |

---

## 7. 实施计划

### Week 1: CW-TS + TD-CA

| 任务 | 文件 | 估计 |
|------|------|------|
| CW-TS 实现 | `lib/rl/bandit/cw-thompson-sampling.ts` | 1天 |
| CW-TS 测试 | `lib/rl/bandit/*.test.ts` | 0.5天 |
| TD-CA 实现 | `lib/rl/reward/time-decay-credit.ts` | 1天 |
| TD-CA 测试 | `lib/rl/reward/*.test.ts` | 0.5天 |
| API 集成 | `app/api/rl/*/route.ts` | 1天 |
| 集成测试 | `e2e/phase2-cwts-tdca.spec.ts` | 1天 |

### Week 2: Distribution Monitor

| 任务 | 文件 | 估计 |
|------|------|------|
| 题目难度漂移检测 | `lib/rl/monitor/difficulty-drift.ts` | 1天 |
| 学生能力漂移检测 | `lib/rl/monitor/ability-drift.ts` | 1天 |
| 奖励漂移检测 | `lib/rl/monitor/reward-drift.ts` | 1天 |
| 综合监控类 | `lib/rl/monitor/distribution.ts` | 1天 |
| 告警集成 | `lib/rl/monitor/alerts.ts` | 0.5天 |
| 测试 | `lib/rl/monitor/*.test.ts` | 1.5天 |

### Week 3: 验证与上线

| 任务 | 估计 |
|------|------|
| 回归测试（Phase 1） | 1天 |
| 性能测试 | 0.5天 |
| 破坏性验证（修复后重跑） | 1天 |
| 文档更新 | 0.5天 |
| 灰度发布（20% → 50% → 100%） | 2天 |

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CW-TS 过度过滤探索 | LE 降低 | 可调 minConfidence，A/B 测试 |
| TD-CA 衰减过强 | 晚答学生reward过低 | 可调 decayHalfLife |
| DistMon 误报 | 不必要重校准 | 调优阈值，增加滞后 |
| 性能开销 | API 变慢 | 异步监控，缓存结果 |
| 与安全壳冲突 | 降级逻辑冲突 | 明确优先级：DistMon > Safety Shell |

---

## 9. 成功标准

| 标准 | 目标 | 验证方式 |
|------|------|---------|
| LE 提升 | ≥ 20% | A/B 测试对比 |
| CS 提升 | ≥ 90% | 稳定性测试 |
| 延迟反馈容忍 | ≤ 2小时 | 回归分析 |
| 漂移检测率 | ≥ 90% | 破坏性测试 |
| 性能 | < 100ms P95 | 性能测试 |

---

## 10. 后续规划

### Phase 3: 完整重构（3-6月）

在 Phase 2 验证有效后，考虑：
- Label Quality Model（题目质量模型）
- Invariant Representation Learning（不变表示学习）
- Adaptation Controller（自适应控制器）

---

## 附录 A: 关键代码片段

### A.1 置信度权重计算

```typescript
function calculateConfidenceWeight(
  pullCount: number,
  scale: number,
  minWeight: number
): number {
  const rawConfidence = 1 - Math.exp(-pullCount / scale);
  return Math.max(minWeight, rawConfidence);
}
```

### A.2 时间衰减函数

```typescript
function calculateDecayWeight(
  delayMs: number,
  halfLife: number,
  minWeight: number
): number {
  const decay = Math.exp(-delayMs / halfLife);
  return Math.max(minWeight, decay);
}
```

### A.3 KS 检验（简化版）

```typescript
function ksTest(sample1: number[], sample2: number[]): number {
  // 计算 Kolmogorov-Smirnov 统计量
  // 返回 p-value
  // 简化实现：使用近似公式
  // 生产环境可使用 stats.js 等库
}
```
