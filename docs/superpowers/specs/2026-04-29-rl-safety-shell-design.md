# RL自适应引擎安全壳修复方案设计

**日期**: 2026-04-29
**状态**: 待审核
**版本**: v1.0

---

## 1. 问题陈述

### 1.1 背景

RL自适应引擎通过破坏性验证（`RL_DESTRUCTION_VALIDATION.md`）发现存在结构性脆弱点：

| 失败类型 | 崩溃条件 | 影响 |
|---------|---------|------|
| 标签混乱 | 标签翻转率 > 20% | 策略完全失效 |
| 反馈延迟 | 延迟 > 30步 或 丢失率 > 15% | 学习链崩溃 |
| 分布偏移 | 严重偏移发生在早期 | 策略失效 |

### 1.2 危险现象：伪收敛

系统存在"指标好看但实际无效"的伪收敛状态：

| 场景 | CS | LE | 实际状态 |
|------|-----|-----|---------|
| 顽固学生 | 89% | 0% | 系统完全不工作 |
| 轻度标签噪声 | 82% | 8% | 学生没有提升 |

### 1.3 产品要求

基于 `PRODUCT.md` 的产品原则：

- **LE 优先于 CS**: 宁可推荐有点波动但有效，不要稳定但无效
- **信任保护优先**: 失效时降级而非崩溃
- **检测优于隐藏**: 必须能检测并报告失效状态
- **降级优于崩溃**: 自动切换到安全模式

---

## 2. 设计目标

### 2.1 约束条件

- **时间**: 1个月紧急
- **风险**: 零容忍（教育产品标准）
- **兼容性**: 允许重置状态

### 2.2 成功标准

| 标准 | 目标 | 验证方式 |
|------|------|---------|
| 伪收敛可检测 | 100% | 所有伪收敛场景被检测 |
| 自动降级 | <5秒 | danger状态5秒内切换规则引擎 |
| LE不降低 | ≥ 15% | 修复后LE仍满足产品目标 |
| 监控覆盖率 | 100% | 所有核心KPI实时监控 |
| 回滚能力 | <1分钟 | 可快速回滚到修复前版本 |

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    现有 RL Engine                           │
│  (Thompson Sampling + IRT + Bandit)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              🔒 安全壳 (Safety Shell) - NEW                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Health Monitor (健康监控)                            │  │
│  │  - LE 实时计算                                         │  │
│  │  - CS 实时计算                                         │  │
│  │  - Label Noise 检测                                    │  │
│  │  - Feedback Delay 监控                                 │  │
│  │  - Pseudo-Convergence 检测                             │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │  Failure Detector (失效检测)                          │  │
│  │  - 基于PRODUCT.md#崩溃边界的阈值判断                  │  │
│  │  - 检测到异常时触发 alert                              │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │  Degradation Controller (降级控制)                    │  │
│  │  - 轻度异常: 增大 exploration                         │  │
│  │  - 中度异常: 切换规则引擎                             │  │
│  │  - 重度异常: 停止RL，人工介入                          │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │  Rule Engine Fallback (规则引擎兜底) - NEW            │  │
│  │  - 基于IRT的简单规则                                  │  │
│  │  - 难度 = clamp(theta + 0.5, 1, 5)                   │  │
│  │  - 保证基本可用性                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 设计原则

1. **非侵入式**: 不修改现有RL核心，在外层包裹保护
2. **可观测**: 所有健康指标实时可查
3. **快速响应**: 检测到异常5秒内降级
4. **安全兜底**: 规则引擎保证最低可用性

---

## 4. 组件设计

### 4.1 Health Monitor（健康监控）

**文件**: `lib/rl/health/monitor.ts`

**职责**: 实时计算系统健康指标

```typescript
interface HealthMetrics {
  // 核心KPI
  le: number;           // Learning Effectiveness
  cs: number;           // Convergence Stability
  dfi: number;          // Data Flow Integrity

  // 异常检测
  labelNoiseRate: number;     // 标签噪声率
  feedbackDelaySteps: number; // 反馈延迟步数
  rewardLossRate: number;     // Reward丢失率

  // 伪收敛检测
  isPseudoConverged: boolean;
  pseudoConvergenceReason?: string;
}

interface HealthStatus {
  level: 'healthy' | 'warning' | 'danger' | 'collapsed';
  metrics: HealthMetrics;
  alerts: string[];
  timestamp: Date;
}
```

**监控指标计算**:

| 指标 | 计算方式 | 检测频率 | 窗口大小 |
|------|---------|---------|---------|
| LE | 滚动窗口能力变化 | 每题 | 100题 |
| CS | 推荐分布方差 | 每题 | 50次推荐 |
| 标签噪声 | 答案与能力估计一致性 | 每题 | 20题 |
| 反馈延迟 | pending reward队列 | 每题 | 实时 |

### 4.2 Failure Detector（失效检测）

**文件**: `lib/rl/health/detector.ts`

**职责**: 基于阈值判断系统健康状态

```typescript
const THRESHOLDS = {
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

function detectFailure(metrics: HealthMetrics): HealthStatus {
  // 综合判断，返回健康状态
  // 任何指标达到danger则整体为danger
  // 任何指标达到warning则整体至少为warning
}
```

### 4.3 Degradation Controller（降级控制）

**文件**: `lib/rl/health/controller.ts`

**职责**: 根据健康状态决定降级行动

```typescript
interface DegradationAction {
  type: 'continue' | 'increase_exploration' | 'switch_to_rule' | 'stop';
  reason: string;
}

function decideDegradation(status: HealthStatus): DegradationAction {
  switch (status.level) {
    case 'healthy':
      return { type: 'continue', reason: 'System normal' };
    case 'warning':
      return {
        type: 'increase_exploration',
        reason: 'Detected anomaly, increasing exploration'
      };
    case 'danger':
      return {
        type: 'switch_to_rule',
        reason: 'System degraded, switching to rule engine'
      };
    case 'collapsed':
      return {
        type: 'stop',
        reason: 'System collapsed, requires manual intervention'
      };
  }
}
```

### 4.4 Rule Engine Fallback（规则引擎兜底）

**文件**: `lib/rl/fallback/rule-engine.ts`

**职责**: 提供简单但可靠的推荐兜底方案

```typescript
// 基于IRT的简单规则，保证基本可用性
function ruleEngineRecommendation(theta: number): number {
  // 推荐略高于当前能力的难度（i+1原则）
  const targetDifficulty = theta + 0.5;
  return clamp(Math.round(targetDifficulty), 1, 5);
}
```

### 4.5 Pseudo-Convergence Detector（伪收敛检测）

**文件**: `lib/rl/health/pseudo-convergence.ts`

**职责**: 检测"指标好看但实际无效"的状态

```typescript
function detectPseudoConvergence(metrics: HealthMetrics): boolean {
  // 基于 PRODUCT.md 的定义
  return (
    (metrics.cs > 0.8 && Math.abs(metrics.le) < 0.01) ||
    (metrics.le < 0.01 && metrics.rewardLossRate > 0.5)
  );
}
```

---

## 5. 数据流

### 5.1 正常流程

```
用户答题 → IRT更新theta → Bandit推荐 → Health Monitor检查 → 返回推荐
                              ↓
                         记录健康指标
```

### 5.2 降级流程

```
用户答题 → Health Monitor检查 → 检测到danger
                              ↓
                    Degradation Controller决策
                              ↓
                    切换到Rule Engine
                              ↓
                    触发告警 → 通知管理员
```

---

## 6. API集成

### 6.1 修改现有API

**文件**: `app/api/rl/next-question/route.ts`

```typescript
// 添加健康检查
const health = healthMonitor.check();
const action = degradationController.decide(health);

if (action.type === 'switch_to_rule') {
  // 使用规则引擎
  difficulty = ruleEngineRecommendation(theta);
} else {
  // 正常RL流程
  difficulty = banditRecommendation(theta);
}
```

### 6.2 新增健康查询API

**端点**: `GET /api/rl/health`

```typescript
interface HealthResponse {
  status: HealthStatus;
  recommendation: 'rl' | 'rule' | 'stop';
  lastUpdated: Date;
}
```

---

## 7. 测试策略

### 7.1 单元测试

| 组件 | 测试内容 |
|------|---------|
| HealthMonitor | 指标计算正确性 |
| FailureDetector | 阈值判断逻辑 |
| DegradationController | 状态机转换 |
| PseudoConvergenceDetector | 伪收敛识别 |
| RuleEngine | 兜底推荐有效性 |

### 7.2 集成测试

| 场景 | 验证内容 |
|------|---------|
| 正常运行 | RL正常工作，健康指标正常 |
| 标签噪声 | 检测到noise，触发warning |
| 伪收敛 | 检测到pseudo-convergence，触发alert |
| 危险状态 | 自动切换到规则引擎 |

### 7.3 破坏性验证

运行 `pnpm test:rl-destruction`，验证：
- 修复前崩溃的场景现在能被检测
- 自动降级在5秒内完成
- 规则引擎推荐可用

---

## 8. 实现计划

### Week 1: 基础设施

| 任务 | 文件 | 估计 |
|------|------|------|
| Health Monitor 基础框架 | `lib/rl/health/monitor.ts` | 2天 |
| 指标计算实现 | `lib/rl/health/metrics.ts` | 2天 |
| 单元测试 | `lib/rl/health/*.test.ts` | 1天 |

### Week 2: 检测与控制

| 任务 | 文件 | 估计 |
|------|------|------|
| Failure Detector | `lib/rl/health/detector.ts` | 2天 |
| Degradation Controller | `lib/rl/health/controller.ts` | 2天 |
| 伪收敛检测 | `lib/rl/health/pseudo-convergence.ts` | 1天 |

### Week 3: 降级方案

| 任务 | 文件 | 估计 |
|------|------|------|
| Rule Engine Fallback | `lib/rl/fallback/rule-engine.ts` | 2天 |
| 集成到现有API | `app/api/rl/*/route.ts` | 2天 |
| 端到端测试 | `e2e/rl-safety-shell.spec.ts` | 1天 |

### Week 4: 验证与上线

| 任务 | 估计 |
|------|------|
| 破坏性验证（修复后重跑） | 2天 |
| 性能测试 | 1天 |
| 文档更新 | 1天 |
| 灰度发布 | 1天 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 规则引擎推荐质量低 | 学生体验下降 | 保守推荐（略简单） |
| 误报（正常时报警） | 不必要降级 | 调优阈值，增加滞后 |
| 性能开销 | API响应变慢 | 异步计算，缓存结果 |
| 状态不一致 | 检测失效 | 定期校验，DFI监控 |

---

## 10. 后续规划

### Phase 2: 核心加固（1-2月）

- Confidence-Weighted Thompson Sampling
- Credit Assignment Layer
- Distribution Monitoring

### Phase 3: 完整重构（3-6月）

- Label Quality Model
- Invariant Representation Learning
- Adaptation Controller

---

## 附录：关键代码片段

### A. 崩溃边界阈值

```typescript
// 基于 PRODUCT.md#崩溃边界
const COLLAPSE_BOUNDARIES = {
  labelNoise: {
    normal: 0.10,
    warning: 0.20,
    danger: 0.30,
  },
  feedbackDelay: {
    normal: 5,
    warning: 15,
    danger: 30,
  },
  le: {
    normal: 0.15,
    warning: 0.05,
    danger: 0.0,
  },
  cs: {
    normal: 0.85,
    warning: 0.70,
    danger: 0.50,
  },
};
```

### B. 伪收敛检测公式

```typescript
// 基于 PRODUCT.md 的定义
function isPseudoConverged(metrics: HealthMetrics): boolean {
  return (
    // 条件1: CS高但LE接近0
    (metrics.cs > 0.8 && Math.abs(metrics.le) < 0.01) ||
    // 条件2: Reward方差高但CS看起来正常
    (metrics.rewardVariance > 0.5 && metrics.cs > 0.7)
  );
}
```

### C. 规则引擎推荐

```typescript
// IRT-based rule engine
function ruleEngineRecommendation(theta: number): number {
  // i+1原则：推荐略高于当前能力的难度
  const targetDifficulty = theta + 0.5;
  return Math.max(1, Math.min(5, Math.round(targetDifficulty)));
}
```
