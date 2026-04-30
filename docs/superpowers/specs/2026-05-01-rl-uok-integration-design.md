# RL-UOK 集成设计：RL 作为 UOK 探索增强

**日期**: 2026-05-01
**状态**: 待审核
**版本**: v1.0

---

## 1. 背景

### 1.1 问题陈述

当前系统存在两套并行推荐系统：

| 系统 | 核心方法 | 状态 |
|------|---------|------|
| UOK | 知识状态机 + 嵌入向量 | 生产使用 |
| RL 引擎 | Bandit + IRT | Phase 1-3 已实现，未接入前端 |

UOK 的局限性：
- 确定性推荐，缺乏探索
- 可能陷入局部最优（伪收敛）
- 无法自适应调整探索率

RL 的优势：
- Thompson Sampling 自然产生探索
- 健康监控防止崩溃
- 自适应探索率控制

### 1.2 集成目标

**RL 作为 UOK 的探索增强层**，不是替代 UOK。

```
┌─────────────────────────────────────────────────────────────┐
│                    前端练习流程                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UOK 推荐引擎                              │
│  - 知识状态追踪                                            │
│  - 缺口检测                                                │
│  - Mastery 计算                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              RL 探索增强层 (NEW)                            │
│  - 健康监控                                                │
│  - 候选数量控制                                            │
│  - 探索因子计算                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  返回 Top-N 候选题                          │
│  - 前端/后端加权选择                                        │
│  - 自然产生探索                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 设计原则

1. **UOK 为主，RL 为辅** — RL 不替代 UOK，只是增强探索
2. **非侵入式** — 不修改 UOK 核心逻辑
3. **可观测** — 所有探索决策可追踪
4. **渐进式** — 可通过开关控制

---

## 3. 架构设计

### 3.1 整体架构

```
lib/rl/exploration/
├── rl-exploration-controller.ts    # 主控制器
├── rl-exploration-controller.test.ts
├── types.ts                      # 接口定义
└── index.ts

lib/qie/
└── recommendation-service.ts      # 修改：集成 RL 探索层
```

### 3.2 数据流

```
getNextQuestion()
    │
    ├─→ UOK.act('next_question') → weakest topic
    │
    ├─→ findBestMatch() → Top-N candidates (N = 10)
    │
    ├─→ RLExplorationController.getCandidateCount()
    │       │
    │       └─→ HealthMonitor.check()
    │       └─→ 探索历史分析
    │
    └─→ 返回 { candidates: Top-N, candidateCount: M }
            │
            └─→ 选择器加权随机选择
```

---

## 4. 组件设计

### 4.1 RLExplorationController

**文件**: `lib/rl/exploration/rl-exploration-controller.ts`

**职责**:
- 封装 HealthMonitor
- 跟踪 UOK 推荐历史
- 计算探索需求
- 返回候选数量

```typescript
export interface ExplorationConfig {
  baseCandidateCount: number;        // 基础候选数 (default: 2)
  maxCandidateCount: number;         // 最大候选数 (default: 5)
  explorationThreshold: number;      // 探索触发阈值 (default: 0.3)
}

export interface ExplorationContext {
  topic: string;
  mastery: number;
  consecutiveSameTopic: number;    // 连续同知识点次数
}

export interface ExplorationResult {
  candidateCount: number;            // 返回候选数量
  explorationLevel: 'minimal' | 'moderate' | 'aggressive';
  factors: {
    healthLevel: HealthLevel;
    consecutiveSameTopic: number;
    le: number;
    cs: number;
  };
  reason: string;
}

export class RLExplorationController {
  private healthMonitor: HealthMonitor;
  private topicHistory: string[] = [];
  private readonly config: ExplorationConfig;

  constructor(config?: Partial<ExplorationConfig>) {
    this.config = {
      baseCandidateCount: config?.baseCandidateCount ?? 2,
      maxCandidateCount: config?.maxCandidateCount ?? 5,
      explorationThreshold: config?.explorationThreshold ?? 0.3,
    };
    this.healthMonitor = new HealthMonitor();
  }

  /**
   * 获取候选数量
   */
  getCandidateCount(context: ExplorationContext): ExplorationResult;

  /**
   * 记录推荐
   */
  recordRecommendation(topic: string): void;

  /**
   * 记录响应（更新健康监控）
   */
  recordResponse(response: {
    topic: string;
    correct: boolean;
    complexity: number;
  }): void;

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus;
}
```

### 4.2 探索数量计算

```typescript
getCandidateCount(context: ExplorationContext): ExplorationResult {
  const health = this.healthMonitor.check();
  const consecutiveSame = this.getConsecutiveSameTopicCount(context.topic);

  let candidateCount = this.config.baseCandidateCount;
  let explorationLevel: ExplorationLevel = 'minimal';
  let reason = 'System healthy, minimal exploration';

  // 基于健康状态的调整
  switch (health.level) {
    case 'warning':
      candidateCount = 3;
      explorationLevel = 'moderate';
      reason = `Health warning: ${health.alerts.join(', ')}`;
      break;

    case 'danger':
      candidateCount = 4;
      explorationLevel = 'aggressive';
      reason = `Health danger: ${health.alerts.join(', ')}`;
      break;

    case 'collapsed':
      candidateCount = this.config.maxCandidateCount;
      explorationLevel = 'aggressive';
      reason = 'System collapsed, maximum exploration';
      break;
  }

  // 基于伪收敛的调整
  if (health.metrics.isPseudoConverged) {
    candidateCount = Math.min(candidateCount + 2, this.config.maxCandidateCount);
    explorationLevel = 'aggressive';
    reason = `Pseudo-convergence detected: ${health.metrics.pseudoConvergenceReason}`;
  }

  // 基于连续同知识点的调整
  if (consecutiveSame >= 3) {
    candidateCount = Math.min(candidateCount + 1, this.config.maxCandidateCount);
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
```

### 4.3 选择器

**文件**: `lib/rl/exploration/selector.ts`

```typescript
/**
 * 基于探索等级选择候选题
 *
 * minimal:    [0.7, 0.2, 0.1, 0, 0]     - 优先最优
 * moderate:   [0.4, 0.25, 0.2, 0.1, 0.05] - 适度探索
 * aggressive: [0.2, 0.2, 0.2, 0.2, 0.2]   - 均匀探索
 */
export function selectCandidate<T>(
  candidates: T[],
  explorationLevel: ExplorationLevel
): T {
  const weights = {
    minimal: [0.7, 0.2, 0.1, 0, 0],
    moderate: [0.4, 0.25, 0.2, 0.1, 0.05],
    aggressive: [0.2, 0.2, 0.2, 0.2, 0.2],
  };

  const w = weights[explorationLevel];
  const cumWeights = candidates.map((_, i) =>
    w[i] ?? w[w.length - 1] / (i - w.length + 1)
  );

  const total = cumWeights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;

  for (let i = 0; i < candidates.length; i++) {
    random -= cumWeights[i];
    if (random <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}
```

---

## 5. UOK 集成

### 5.1 修改 recommendation-service.ts

```typescript
// lib/qie/recommendation-service.ts

import { RLExplorationController } from '@/lib/rl/exploration';
import { isFeatureEnabled } from '@/lib/rl/config/phase3-features';

// 全局实例（单例模式）
let rlController: RLExplorationController | null = null;

function getRLController(): RLExplorationController | null {
  if (!isFeatureEnabled('adaptation')) return null;
  if (!rlController) {
    rlController = new RLExplorationController();
  }
  return rlController;
}

export async function getNextQuestion(request: NextQuestionRequest): Promise<NextQuestionResponse> {
  const rl = getRLController();

  // ... UOK 逻辑 ...
  const topic = action.topic;
  const mastery = /* 从 UOK 获取 */;

  // 获取候选题
  const candidates = await findTopNCandidates(topic, mastery, 10);

  if (!rl) {
    // 不使用 RL，直接返回最佳
    return candidates[0];
  }

  // 获取探索需求
  const exploration = rl.getCandidateCount({
    topic,
    mastery,
    consecutiveSameTopic: rl.getConsecutiveSameTopicCount(topic),
  });

  // 选择候选
  const selected = selectCandidate(
    candidates.slice(0, exploration.candidateCount),
    exploration.explorationLevel
  );

  // 记录推荐
  rl.recordRecommendation(topic);

  return {
    success: true,
    question: selected,
    rationale: {
      ...baseRationale,
      explorationInfo: {
        candidateCount: exploration.candidateCount,
        explorationLevel: exploration.explorationLevel,
        reason: exploration.reason,
      },
    },
  };
}
```

### 5.2 响应记录

```typescript
// 在 recordResponse 中集成
export async function encodeAnswerToUOK(
  studentId: string,
  questionId: string,
  correct: boolean
): Promise<{ probability: number }> {
  const rl = getRLController();
  const question = /* 获取题目信息 */;

  // ... UOK 逻辑 ...

  // 记录到 RL 健康监控
  if (rl) {
    rl.recordResponse({
      topic: question.knowledgePoints[0],
      correct,
      complexity: question.complexity ?? 0.5,
    });
  }

  return { probability };
}
```

---

## 6. 特性开关

```typescript
// lib/rl/config/phase3-features.ts

export const PHASE_3_FEATURES = {
  // ... 现有配置 ...

  uokIntegration: {
    enabled: process.env.RL_UOK_INTEGRATION_ENABLED !== 'false',
    config: {
      baseCandidateCount: parseInt(process.env.RL_BASE_CANDIDATE_COUNT || '2'),
      maxCandidateCount: parseInt(process.env.RL_MAX_CANDIDATE_COUNT || '5'),
    },
  },
};
```

### 环境变量

```bash
# RL-UOK 集成开关
RL_UOK_INTEGRATION_ENABLED=true
RL_BASE_CANDIDATE_COUNT=2
RL_MAX_CANDIDATE_COUNT=5
```

---

## 7. 测试策略

### 7.1 单元测试

| 组件 | 测试内容 |
|------|---------|
| RLExplorationController | 探索数量计算、边界条件 |
| Selector | 加权随机选择、均匀分布验证 |
| HealthMonitor 集成 | UOK 响应记录 |

### 7.2 集成测试

| 场景 | 验证内容 |
|------|---------|
| UOK + RL 正常 | 返回 2 个候选，权重正确 |
| 健康警告 | 返回 3 个候选，探索等级 moderate |
| 伪收敛 | 返回 4-5 个候选，探索等级 aggressive |
| 开关关闭 | 直接返回最佳候选 |

---

## 8. 实施计划

### Week 1: 基础组件

| 任务 | 文件 | 估计 |
|------|------|------|
| RLExplorationController 核心 | `lib/rl/exploration/rl-exploration-controller.ts` | 1天 |
| Selector 工具 | `lib/rl/exploration/selector.ts` | 0.5天 |
| 单元测试 | `lib/rl/exploration/*.test.ts` | 0.5天 |

### Week 2: UOK 集成

| 任务 | 文件 | 估计 |
|------|------|------|
| 修改 recommendation-service | `lib/qie/recommendation-service.ts` | 1天 |
| 响应记录集成 | `encodeAnswerToUOK` | 0.5天 |
| 集成测试 | `lib/qie/__tests__/integration.test.ts` | 0.5天 |

### Week 3: 验证

| 任务 | 估计 |
|------|------|
| 模拟器测试 | 1天 |
| 性能测试 | 0.5天 |
| 文档更新 | 0.5天 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 候选题不足 | 返回不够多样性 | 限制候选数量，至少返回 1 个 |
| 选择器不均匀 | 探索不够随机 | 验证选择器分布 |
| 性能开销 | API 响应变慢 | 缓存 RL 控制器实例 |

---

## 10. 成功标准

| 标准 | 目标 | 验证方式 |
|------|------|----------|
| 集成不影响现有功能 | UOK 测试全部通过 | 回归测试 |
| 探索正常工作 | 伪收敛场景返回多候选 | 单元测试 |
| 性能无退化 | API 响应 < 100ms | 性能测试 |

---

## 附录 A: 完整接口

```typescript
// lib/rl/exploration/types.ts

export type HealthLevel = 'healthy' | 'warning' | 'danger' | 'collapsed';
export type ExplorationLevel = 'minimal' | 'moderate' | 'aggressive';

export interface ExplorationConfig {
  baseCandidateCount: number;
  maxCandidateCount: number;
  explorationThreshold: number;
}

export interface ExplorationContext {
  topic: string;
  mastery: number;
  consecutiveSameTopic: number;
}

export interface ExplorationResult {
  candidateCount: number;
  explorationLevel: ExplorationLevel;
  factors: {
    healthLevel: HealthLevel;
    consecutiveSameTopic: number;
    le: number;
    cs: number;
  };
  reason: string;
}

export interface ExplorationRecord {
  topic: string;
  timestamp: number;
  complexity: number;
}
```

## 附录 B: 选择器权重

| Exploration Level | Rank 1 | Rank 2 | Rank 3 | Rank 4 | Rank 5 |
|-------------------|--------|--------|--------|--------|--------|
| minimal | 0.70 | 0.20 | 0.10 | 0.00 | 0.00 |
| moderate | 0.40 | 0.25 | 0.20 | 0.10 | 0.05 |
| aggressive | 0.20 | 0.20 | 0.20 | 0.20 | 0.20 |
