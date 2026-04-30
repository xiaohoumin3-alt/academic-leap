# CLAUDE.md - 学力跃迁项目指南

> **产品定义源文档**: 本文档的技术标准和验收标准基于 [PRODUCT.md](./PRODUCT.md) 中定义的产品目标、KPI和权衡原则。
> 当技术决策存在冲突时，应回溯到 PRODUCT.md 中的产品原则进行决策。

## 项目概述
Next.js + Supabase + Prisma + Gemini AI 的数学练习平台

---

## ✅ 收敛系统 v1.0 验收标准（可交付版本）

### 三个核心指标（删掉所有理论，只保留可测量）

#### ① 数据链完整度（Data Flow Integrity, DFI）

**衡量**：题目 → 作答 → 诊断 → 推荐 是否全链路可追踪

**定义**：每一次学习事件必须有唯一ID贯穿全流程

**计算**：
```
DFI = trace_complete_events / total_events
```

**目标**：`DFI ≥ 0.99`

---

#### ② 预测有效性（Learning Effectiveness, LE）

**衡量**：系统推荐/诊断是否真的"带来学习提升"

**定义**：学生在推荐后同类题正确率是否提升

**计算**：
```
LE = avg(post_accuracy - pre_accuracy)

或更稳一点：
LE = P(correct | after_recommendation) - P(correct | before)
```

**目标**：`LE > 0.15`（至少提升15%）

---

#### ③ 稳定收敛性（Convergence Stability, CS）

**衡量**：系统输出是否稳定（不乱跳、不漂移）

**定义**：同一知识点在多次评估中的推荐差异

**计算**：
```
CS = 1 - variance(recommendation_distribution)

或：
CS = similarity(top_k_recommendations across runs)
```

**目标**：`CS ≥ 0.85`

---

### 收敛公式（系统是否"完成"）

```
Converged =
  (DFI ≥ 0.99)
  AND (LE ≥ 0.15)
  AND (CS ≥ 0.85)
```

👉 **人话解释**：数据是通的 + 学生真的变好了 + 系统不乱变 = 才算系统收敛

---

### CI 门禁（工程化核心）

**Pre-merge / Pre-deploy Gate**

```yaml
CI_GATES:
  data_integrity:
    rule: DFI >= 0.99
    block_on_fail: true

  learning_gain:
    rule: LE >= 0.15
    window: last_100_sessions
    block_on_fail: true

  stability_check:
    rule: CS >= 0.85
    runs: 5_seeds
    block_on_fail: true
```

| 阶段   | 是否阻断 |
|--------|----------|
| commit | ❌       |
| merge  | ✅       |
| deploy | ✅       |

🚫 **CI失败直接阻断 merge 和 deploy**

---

## 技术栈

- **Frontend**: Next.js 15, React 19, Tailwind, Framer Motion
- **Backend**: Next.js API Routes, Prisma ORM
- **Auth**: NextAuth.js v5 (beta)
- **AI**: Gemini API
- **DB**: PostgreSQL (Supabase)
- **Testing**: Playwright (E2E), Jest (unit)

---

## 开发工作流

### TDD 流程
1. 写测试（RED）
2. 实现功能（GREEN）
3. 重构（IMPROVE）
4. 验证覆盖率

### Pre-commit 检查
```bash
pnpm tsc --noEmit  # 类型检查
pnpm lint           # 代码规范
```

### Pre-merge 检查
```bash
pnpm build          # 构建检查
pnpm test           # 单元测试
pnpm test:e2e       # E2E测试
```

### CI 门禁验证
```bash
# 数据链完整度测试
pnpm test:data-integrity

# 预测有效性测试
pnpm test:learning-effectiveness

# 稳定收敛性测试
pnpm test:stability
```

---

## 数据模型关键约定

### 学习事件追踪
- 每次 `Attempt` 必须有唯一 `eventId`
- `AttemptStep` 必须关联父 `eventId`
- AI 诊断结果必须关联 `eventId`

### 推荐系统
- 推荐必须记录 `preAccuracy` 和 `postAccuracy`
- 同一知识点的多次推荐需要计算方差
- Top-K 推荐需要持久化用于相似度计算

---

## RL健康监控

RL自适应引擎的安全壳保护层，位于 `lib/rl/health/`。

### 架构

```
HealthMonitor (健康监控)
    ↓
FailureDetector (失效检测)
    ↓
DegradationController (降级控制)
    ↓
RuleEngine (规则引擎兜底)
```

### 健康指标

| 指标 | 说明 | 目标值 |
|------|------|--------|
| LE | 学习有效性 | > 0.15 |
| CS | 收敛稳定性 | > 0.85 |
| DFI | 数据完整度 | > 0.99 |
| labelNoiseRate | 标签噪声率 | < 0.10 |
| feedbackDelaySteps | 反馈延迟步数 | < 5 |

### 降级行动

| 状态 | 行动 |
|------|------|
| healthy | 继续RL |
| warning | 增大exploration |
| danger | 切换规则引擎 |
| collapsed | 停止RL |

### API集成

```typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { decideDegradation } from '@/lib/rl/health/controller';

const healthMonitor = new HealthMonitor();
const healthStatus = healthMonitor.check();
const action = decideDegradation(healthStatus);

if (action.type === 'switch_to_rule') {
  // 降级到规则引擎
}
```

详见 [lib/rl/health/README.md](./lib/rl/health/README.md)。

---

## Phase 2: 核心加固 (2026-04-30)

### 组件

| 组件 | 文件 | 描述 |
|------|------|------|
| CW-TS | `lib/rl/bandit/cw-thompson-sampling.ts` | 置信度加权采样 |
| TD-CA | `lib/rl/reward/time-decay-credit.ts` | 时间衰减 Credit Assignment |
| DistMon | `lib/rl/monitor/distribution.ts` | 分布监控（三类漂移检测） |

### 特性开关

```bash
RL_CWTS_ENABLED=true
RL_TDCA_ENABLED=true
RL_DISTMON_ENABLED=true
```

### API 端点

- `POST /api/rl/recalibrate` - 手动触发重校准

---

## Phase 3: 完整重构 (2026-05-01)

### 组件

| 组件 | 文件 | 描述 |
|------|------|------|
| LQM | `lib/rl/quality/label-quality.ts` | 题目标签质量估计与修正 |
| Normalizer | `lib/rl/normalize/feature-normalizer.ts` | z-score 特征归一化 |
| Adaptation | `lib/rl/control/adaptation-controller.ts` | 自适应探索率控制 |

### 特性开关

```bash
RL_LQM_ENABLED=true
RL_NORMALIZER_ENABLED=true
RL_ADAPTATION_ENABLED=true
```

### API 端点

- `GET /api/rl/quality-report` - Phase 3 组件状态报告

---

## 产品原则映射

当遇到技术冲突时，参考 [PRODUCT.md#权衡原则](./PRODUCT.md#8-权衡原则-trade-off-principles)：

| 冲突场景 | 产品原则 | 技术决策 |
|---------|---------|---------|
| 优化CS可能降低LE | **LE 优先于 CS** | 不优化，保持LE |
| 不确定推荐准确性 | **信任保护优先** | 保守推荐 |
| 系统可能失效 | **检测优于隐藏** | 添加监控 |
| 检测到异常 | **降级优于崩溃** | 切换规则引擎 |

---

## 行为指南（通用）

### 1. Think Before Coding
- 状态假设明确说明。不确定就问。
- 多种解释存在时，列出来——不要默默选。
- 存在更简单的方式，说出来。该推就推。

### 2. Simplicity First
- 不做需求外的功能
- 不为单次用代码抽象
- 不做未被请求的"灵活性"
- 不为不可能场景处理错误

### 3. Surgical Changes
- 只改必须改的
- 不"改进"相邻代码
- 匹配现有风格

### 4. Goal-Driven Execution
- 定义成功标准
- 循环直到验证
