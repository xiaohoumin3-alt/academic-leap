# RL自适应引擎 Phase 3 完整重构设计

**日期**: 2026-05-01
**状态**: 待审核
**版本**: v1.0
**前序**:
- [Phase 1 安全壳设计](./2026-04-29-rl-safety-shell-design.md)
- [Phase 2 核心加固设计](./2026-04-30-rl-core-reinforcement-design.md)

---

## 1. 背景与目标

### 1.1 Phase 1/2 回顾

| Phase | 状态 | 解决的问题 |
|-------|------|-----------|
| Phase 1 | ✅ 完成 | 安全壳 - 检测和降级 |
| Phase 2 | ✅ 完成 | 核心加固 - CW-TS, TD-CA, DistMon |
| Phase 3 | 🔄 设计中 | 完整重构 - 根本性修复 |

### 1.2 Phase 3 目标

在 Phase 1/2 的检测和保护基础上，从根本上加固 RL 算法：

| 组件 | 问题 | 解决方案 | 预期收益 |
|------|------|----------|----------|
| Label Quality Model | 题目标签噪声导致策略失效 | IRT 扩展，同时估计能力和标签质量 | LE +10-15% |
| Feature Normalization | 分布偏移导致策略失效 | z-score 归一化消除偏移 | CS +10% |
| Adaptation Controller | 固定探索率不够鲁棒 | 动态调整探索率 | 鲁棒性提升 |

### 1.3 约束条件

- **时间**: 3-4周
- **风险**: 中等（有 Phase 1/2 保护）
- **兼容性**: 不破坏现有 API
- **回滚**: 每个组件可独立禁用

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1/2: Safety + Monitoring               │
│  (Health Monitor, Failure Detector, Degradation Controller)    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ Label Quality│        │    IRL      │        │ Adaptation  │
│ Model       │        │ Normalizer  │        │ Controller  │
│ (IRT扩展)   │        │ (z-score)   │        │             │
└──────────────┘        └──────────────┘        └──────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RL Engine Core (不变)                        │
│  (Thompson Sampling + Bandit + IRT Estimator)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 方案选择：渐进式重构（方案 A）

**设计原则**：
1. **非侵入式**: 在现有组件上添加层，不修改核心逻辑
2. **可独立降级**: 每个组件可单独禁用
3. **渐进式交付**: 可分阶段发布

---

## 3. 组件设计

### 3.1 Label Quality Model (LQM)

**文件**: `lib/rl/quality/label-quality.ts`

**职责**: 评估和修正题目标签噪声

#### 3.1.1 问题定义

传统 IRT 假设题目标签正确，但现实中：
- 题目可能有错误答案
- 评分标准可能不一致
- 学生可能随机作答

**解决方案**: 扩展 IRT 模型，同时估计：
- θ: 学生能力
- b: 题目难度
- q: 题目质量（标签正确概率）

#### 3.1.2 接口设计

```typescript
interface QuestionQuality {
  questionId: string;
  estimatedQuality: number;  // 0-1, 标签正确的概率
  confidence: number;        // 估计置信度
  isNoisy: boolean;          // 是否被判定为噪声
  correction: number;         // 标签修正量
}

interface LabelQualityConfig {
  noiseThreshold: number;     // 判定为噪声的阈值 (default: 0.7)
  minAttempts: number;        // 最小尝试次数 (default: 20)
  decayRate: number;          // 旧数据衰减率 (default: 0.95)
}

interface LabelQualityModel {
  // 估计题目质量
  estimateQuality(questionId: string, history: ResponseHistory[]): QuestionQuality;

  // 修正标签用于训练
  correctLabel(questionId: string, originalLabel: boolean): CorrectedLabel;

  // 更新模型
  update(questionId: string, response: StudentResponse): void;
}
```

#### 3.1.3 算法

**简化 IRT 模型扩展**:
```typescript
// P(correct) = quality * IRT_prob + (1 - quality) * random_prob
P(correct) = q * 1/(1+exp(-(θ-b))) + (1-q) * 0.5

// 使用 EM 算法估计 q:
// E-step: 估计每个响应的真实标签
// M-step: 最大化似然估计 q
```

**标签修正策略**:
```typescript
if (quality < noiseThreshold) {
  // 低质量题目：使用模型预测而非标签
  correctedLabel = model.predict(studentAbility, questionDifficulty);
} else {
  // 高质量题目：使用原始标签
  correctedLabel = originalLabel;
}
```

#### 3.1.4 与现有组件集成

```typescript
// 在 record-response 中集成
const lqm = new LabelQualityModel(config);

// 获取修正后的标签
const corrected = lqm.correctLabel(questionId, response.correct);

// 使用修正标签更新 bandit
bandit.update(deltaC, corrected.value);
```

---

### 3.2 Feature Normalization (IRL)

**文件**: `lib/rl/normalize/feature-normalizer.ts`

**职责**: 消除特征分布偏移

#### 3.2.1 问题定义

Thompson Sampling 在训练分布和推理分布不一致时会失效：
- 学生群体能力变化
- 题目难度标注漂移
- 时间导致的分布变化

**解决方案**: z-score 归一化

#### 3.2.2 接口设计

```typescript
interface NormalizationStats {
  mean: number;
  std: number;
  count: number;
}

interface FeatureNormalizer {
  // 归一化特征
  normalize(value: number, feature: string): number;

  // 反归一化（用于解释）
  denormalize(normalized: number, feature: string): number;

  // 更新统计
  update(value: number, feature: string): void;

  // 批量更新
  updateBatch(values: number[], feature: string): void;

  // 获取统计信息
  getStats(feature: string): NormalizationStats;
}
```

#### 3.2.3 算法

**z-score 归一化**:
```typescript
function normalize(value: number, stats: NormalizationStats): number {
  if (stats.std === 0) return 0;
  return (value - stats.mean) / stats.std;
}

// 滑动窗口统计（防止分布剧变）
function updateStats(value: number, windowSize: number = 1000): NormalizationStats {
  // 移除最旧的，添加最新的
  // 计算新的 mean 和 std
}
```

**与 CW-TS 集成**:
```typescript
// 在选择臂之前归一化
const normalizedAbility = normalizer.normalize(theta, 'ability');
const arm = cwts.selectArm(normalizedAbility);
```

---

### 3.3 Adaptation Controller

**文件**: `lib/rl/control/adaptation-controller.ts`

**职责**: 根据系统状态动态调整探索率

#### 3.3.1 问题定义

固定探索率 (ε) 不能适应所有情况：
- 学习初期需要更多探索
- 学习后期需要更多利用
- 异常情况需要特殊处理

**解决方案**: 基于置信度和学习进度的自适应探索

#### 3.3.2 接口设计

```typescript
interface AdaptationConfig {
  baseExplorationRate: number;     // 基础探索率 (default: 0.1)
  minExplorationRate: number;     // 最小探索率 (default: 0.01)
  adaptationSpeed: number;         // 适应速度 (default: 0.1)
  confidenceThreshold: number;     // 高置信度阈值 (default: 0.8)
}

interface AdaptationState {
  currentExplorationRate: number;
  confidenceLevel: number;
  learningProgress: number;
  recommendedAction: 'explore' | 'exploit' | 'maintain';
}

interface AdaptationController {
  // 计算当前探索率
  getExplorationRate(state: HealthStatus): number;

  // 获取建议
  getRecommendation(): AdaptationState;

  // 更新状态
  update(metrics: HealthMetrics): void;
}
```

#### 3.3.3 算法

**自适应探索率**:
```typescript
function calculateExplorationRate(
  confidence: number,      // 当前置信度
  progress: number,       // 学习进度 0-1
  config: AdaptationConfig
): number {
  // 高置信度 + 高进度 → 低探索率
  const confidenceFactor = 1 - confidence;
  const progressFactor = progress;

  const rate = config.baseExplorationRate
    * confidenceFactor
    * (1 - progressFactor * 0.9);

  return Math.max(config.minExplorationRate, rate);
}
```

**与 Thompson Sampling 集成**:
```typescript
// 在选择臂时加入探索
const baseArm = cwts.selectArm(normalizedAbility);
const explorationBoost = (Math.random() - 0.5) * 2 * explorationRate;

if (Math.random() < explorationRate) {
  // 强制探索随机臂
  return randomArm();
}
```

---

## 4. 数据流

### 4.1 正常流程

```
用户答题
    ↓
Label Quality Model → 修正标签
    ↓
Feature Normalizer → 归一化特征
    ↓
Adaptation Controller → 计算探索率
    ↓
CW-TS → 选择臂
    ↓
返回推荐
```

### 4.2 标签修正流程

```
原始响应 (correct: true)
    ↓
LQM 评估题目质量 (quality: 0.6)
    ↓
quality < threshold (0.7)?
    ↓ 是
模型预测标签 → 修正为 false
    ↓
Bandit 更新使用修正标签
```

---

## 5. API 集成

### 5.1 修改现有 API

**文件**: `app/api/rl/record-response/route.ts`

```typescript
// 添加 Phase 3 组件
import { LabelQualityModel } from '@/lib/rl/quality/label-quality';
import { FeatureNormalizer } from '@/lib/rl/normalize/feature-normalizer';
import { AdaptationController } from '@/lib/rl/control/adaptation-controller';

// 集成
const lqm = new LabelQualityModel(lqmConfig);
const normalizer = new FeatureNormalizer();
const adaptation = new AdaptationController(adaptConfig);

// 在 reward 计算后应用标签修正
const corrected = lqm.correctLabel(questionId, response.correct);
bandit.update(deltaC, corrected.value);

// 更新统计
normalizer.update(theta, 'ability');
adaptation.update(healthMetrics);
```

### 5.2 新增 API

**端点**: `GET /api/rl/quality-report`

```typescript
interface QualityReportResponse {
  questionQuality: QuestionQuality[];
  distributionStats: Record<string, NormalizationStats>;
  adaptationState: AdaptationState;
  timestamp: Date;
}
```

---

## 6. 配置管理

### 6.1 特性开关

```typescript
// lib/rl/config/phase3-features.ts
export const PHASE_3_FEATURES = {
  lqm: {
    enabled: process.env.RL_LQM_ENABLED !== 'false',
    config: {
      noiseThreshold: parseFloat(process.env.RL_LQM_NOISE_THRESHOLD || '0.7'),
      minAttempts: parseInt(process.env.RL_LQM_MIN_ATTEMPTS || '20', 10),
      decayRate: parseFloat(process.env.RL_LQM_DECAY_RATE || '0.95'),
    },
  },
  normalizer: {
    enabled: process.env.RL_NORMALIZER_ENABLED !== 'false',
    config: {
      windowSize: parseInt(process.env.RL_NORMALIZER_WINDOW || '1000', 10),
    },
  },
  adaptation: {
    enabled: process.env.RL_ADAPTATION_ENABLED !== 'false',
    config: {
      baseExplorationRate: parseFloat(process.env.RL_ADAPTATION_BASE_RATE || '0.1'),
      minExplorationRate: parseFloat(process.env.RL_ADAPTATION_MIN_RATE || '0.01'),
      adaptationSpeed: parseFloat(process.env.RL_ADAPTATION_SPEED || '0.1'),
      confidenceThreshold: parseFloat(process.env.RL_ADAPTATION_CONFIDENCE_THRESHOLD || '0.8'),
    },
  },
};
```

### 6.2 环境变量

```bash
# Label Quality Model
RL_LQM_ENABLED=true
RL_LQM_NOISE_THRESHOLD=0.7
RL_LQM_MIN_ATTEMPTS=20
RL_LQM_DECAY_RATE=0.95

# Feature Normalizer
RL_NORMALIZER_ENABLED=true
RL_NORMALIZER_WINDOW=1000

# Adaptation Controller
RL_ADAPTATION_ENABLED=true
RL_ADAPTATION_BASE_RATE=0.1
RL_ADAPTATION_MIN_RATE=0.01
RL_ADAPTATION_SPEED=0.1
RL_ADAPTATION_CONFIDENCE_THRESHOLD=0.8
```

---

## 7. 测试策略

### 7.1 单元测试

| 组件 | 测试内容 | 目标覆盖率 |
|------|---------|-----------|
| LQM | 质量估计、标签修正、EM 收敛 | 90%+ |
| Normalizer | 归一化、反归一化、统计更新 | 95%+ |
| Adaptation | 探索率计算、状态转换 | 90%+ |

### 7.2 集成测试

| 场景 | 验证内容 |
|------|---------|
| LQM + Bandit | 噪声标签被修正后 bandit 正常更新 |
| Normalizer + CW-TS | 归一化后 CW-TS 正常工作 |
| Adaptation + Health | 探索率根据健康状态调整 |

### 7.3 回归测试

运行 Phase 1/2 的所有测试，确保：
- 186 个测试全部通过
- LE、CS、DFI 指标不降低
- Phase 1/2 功能正常

### 7.4 性能测试

| 指标 | 目标 |
|------|------|
| API 响应时间 | < 100ms (P95) |
| 内存增加 | < 30MB |
| LQM 计算开销 | < 10ms |

---

## 8. 实施计划

### Week 1: Label Quality Model

| 任务 | 文件 | 估计 |
|------|------|------|
| LQM 核心实现 | `lib/rl/quality/label-quality.ts` | 2天 |
| 标签修正逻辑 | `lib/rl/quality/label-correction.ts` | 1天 |
| LQM 测试 | `lib/rl/quality/*.test.ts` | 1天 |
| API 集成 | `app/api/rl/record-response/route.ts` | 1天 |

### Week 2: Feature Normalization + Adaptation

| 任务 | 文件 | 估计 |
|------|------|------|
| Normalizer 实现 | `lib/rl/normalize/feature-normalizer.ts` | 1天 |
| Adaptation 实现 | `lib/rl/control/adaptation-controller.ts` | 1天 |
| 测试 | 相关测试文件 | 1天 |
| API 集成 | next-question API | 1天 |

### Week 3-4: 验证与上线

| 任务 | 估计 |
|------|------|
| 回归测试 | 1天 |
| 性能测试 | 1天 |
| 破坏性验证重跑 | 2天 |
| 文档更新 | 0.5天 |
| 灰度发布 | 1.5天 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LQM EM 不收敛 | 质量估计失效 | 添加最大迭代次数，检查收敛条件 |
| 归一化丢失信息 | 推荐变差 | 仅在分布偏移时应用 |
| 探索率调整振荡 | 系统不稳定 | 添加滞后，使用滑动平均 |
| 与 Phase 1/2 冲突 | 降级逻辑混乱 | 明确优先级：LQM > Normalizer > Adaptation |

---

## 10. 成功标准

| 标准 | 目标 | 验证方式 |
|------|------|---------|
| LE 提升 | ≥ 25% | A/B 测试对比 |
| CS 提升 | ≥ 90% | 稳定性测试 |
| 标签质量估计准确率 | ≥ 80% | 人工验证 |
| 归一化有效性 | 分布偏移 < 5% | KS 检验 |
| 探索率调整响应 | < 1秒 | 响应时间测试 |

---

## 附录 A: 关键代码片段

### A.1 标签质量估计

```typescript
function estimateQuestionQuality(
  attempts: { correct: boolean; theta: number }[],
  difficulty: number
): number {
  // 统计一致性
  const avgTheta = attempts.reduce((sum, a) => sum + a.theta, 0) / attempts.length;
  const correctRate = attempts.filter(a => a.correct).length / attempts.length;

  // IRT 预测
  const predictedProb = 1 / (1 + Math.exp(-(avgTheta - difficulty)));

  // 一致性得分
  const consistency = 1 - Math.abs(correctRate - predictedProb);

  // 样本量调整
  const sampleAdjustment = Math.min(1, attempts.length / 20);

  return consistency * sampleAdjustment;
}
```

### A.2 特征归一化

```typescript
class RollingNormalizer {
  private window: number[] = [];
  private readonly size: number;

  constructor(size: number = 1000) {
    this.size = size;
  }

  update(value: number): void {
    this.window.push(value);
    if (this.window.length > this.size) {
      this.window.shift();
    }
  }

  normalize(value: number): number {
    const mean = this.window.reduce((a, b) => a + b, 0) / this.window.length;
    const variance = this.window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this.window.length;
    const std = Math.sqrt(variance);

    return std === 0 ? 0 : (value - mean) / std;
  }
}
```

### A.3 自适应探索率

```typescript
function adaptExplorationRate(
  confidence: number,
  learningProgress: number,
  config: AdaptationConfig
): number {
  const base = config.baseExplorationRate;
  const min = config.minExplorationRate;

  // 置信度越高，探索越少
  const confidenceFactor = Math.pow(1 - confidence, config.adaptationSpeed);

  // 学习进度越高，探索越少
  const progressFactor = Math.pow(1 - learningProgress, config.adaptationSpeed * 2);

  const rate = base * confidenceFactor * progressFactor;

  return Math.max(min, rate);
}
```
