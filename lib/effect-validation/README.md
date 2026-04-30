# Effect Validation System

## 概述

验证 AI 生成模板是否真的提升学生学习效果。通过影子模式收集数据、A/B 实验测试、灰度发布和自动降级，确保只有经过验证的模板才会全量上线。

## 架构

```
ShadowCollector → ExperimentManager → CanaryController → LEAnalyzer → GracefulDegrader
     ↓                   ↓                 ↓              ↓              ↓
  收集数据           A/B 实验          灰度发布       LE 计算         异常降级
```

## 核心指标

| 指标 | 目标 | 计算方式 |
|------|------|----------|
| LE（学习有效性） | ≥ 0.15 | P(correct \| after) - P(correct \| before) |
| DFI（数据链完整度） | ≥ 0.99 | trace_complete_events / total_events |
| 统计显著性 | p < 0.05 | 每组至少 50 样本 |
| 异常检测响应时间 | < 5 分钟 | 指标异常到降级完成 |

## 组件

### ShadowCollector

影子模式收集器，新模板上线后先在影子模式收集数据，不影响线上。

```typescript
import { ShadowCollector } from '@/lib/effect-validation/shadow-collector';

const collector = new ShadowCollector(prisma);

// 记录影子尝试
await collector.recordShadowAttempt({
  templateId: 't-1',
  userId: 'u-1',
  knowledgePoint: 'kp-1',
  isCorrect: true,
  duration: 30,
});

// 检查是否达到分析阈值
const ready = await collector.isReadyForAnalysis('t-1');
// ready === true 当样本数 >= 50
```

### ExperimentManager

A/B 实验管理器，分流用户，计算统计显著性。

```typescript
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';

const manager = new ExperimentManager(prisma);

// 创建实验
const expId = await manager.createExperiment({
  name: 'New Template vs Baseline',
  controlTemplateId: 'baseline',
  treatmentTemplateId: 'new-template',
  targetMetric: 'accuracy',
  minSampleSize: 50,
});

// 分配用户变体
const variant = await manager.assignVariant('user-1', expId);
// variant === 'control' | 'treatment'

// 分析实验结果
const result = await manager.analyzeExperiment(expId);
// result.significant === true 当 p < 0.05
```

### CanaryController

灰度控制器，控制新模板放量节奏。

```typescript
import { CanaryController } from '@/lib/effect-validation/canary-controller';

const controller = new CanaryController(prisma);

// 启动灰度发布
await controller.startCanary('t-1');

// 增加流量
await controller.increaseTraffic('t-1');
// 流量阶段: 5% → 10% → 25% → 50% → 100%

// 回滚
await controller.rollback('t-1');
```

### LEAnalyzer

学习有效性分析器，计算 LE，检测异常。

```typescript
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

const analyzer = new LEAnalyzer(prisma);

// 计算全局 LE
const globalLE = await analyzer.calculateGlobalLE();
// globalLE.le >= 0.15 表示学习有效性达标

// 检测异常
const anomalies = await analyzer.detectAnomalies();
// 返回需要关注的异常列表
```

### GracefulDegrader

优雅降级器，指标异常时自动降级。

```typescript
import { GracefulDegrader, DEGRADATION_RULES } from '@/lib/effect-validation/graceful-degrader';

const degrader = new GracefulDegrader(prisma);

// 降级操作
await degrader.degrade('t-1', 'LE drop 20%', 'danger');

// 恢复到规则引擎
await degrader.switchToRuleEngine('t-1');

// 恢复
await degrader.recover('t-1');
```

## 降级规则

| 严重程度 | 阈值 | 行动 |
|----------|------|------|
| warning | LE 下降 10% | 增加探索比例 |
| danger | LE 下降 20% | 切换到规则引擎 |
| critical | LE 下降 30% | 立即回滚 |

## API 端点

### Dashboard
```
GET /api/effect-validation/dashboard
```

### 实验管理
```
GET    /api/effect-validation/experiments
POST   /api/effect-validation/experiments
GET    /api/effect-validation/experiments/:id
GET    /api/effect-validation/experiments/:id/results
PATCH  /api/effect-validation/experiments/:id
```

### 灰度发布
```
GET    /api/effect-validation/canaries
POST   /api/effect-validation/canaries
GET    /api/effect-validation/canaries/:templateId
POST   /api/effect-validation/canaries/:templateId/increase
POST   /api/effect-validation/canaries/:templateId/rollback
POST   /api/effect-validation/canaries/:templateId/pause
```

### 学习有效性
```
GET /api/effect-validation/le
GET /api/effect-validation/le/:knowledgePointId
```

## 新模板上线流程

```
1. 模板生成完成
       ↓
2. 自动进入 Shadow Mode
       ↓ (收集 ≥50 样本)
3. 创建 A/B 实验
       ↓
4. 运行实验 (每组 ≥50 样本)
       ↓
5. 分析结果：
   - 显著提升 → 启动 Canary
   - 无显著差异 → 继续收集
   - 显著下降 → 拒绝并分析
       ↓
6. Canary 灰度发布
   5% → 10% → 25% → 50% → 100%
       ↓
7. 全量发布
```

## 配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| LE_TARGET | 0.15 | 学习有效性目标 |
| CANARY_STAGES | [5, 10, 25, 50, 100] | 灰度阶段百分比 |
| STAGE_DURATION_HOURS | 24 | 每阶段最少运行时间 |
| MIN_SAMPLE_SIZE | 50 | 每组最小样本数 |
| SIGNIFICANCE_LEVEL | 0.05 | 统计显著性阈值 (p < 0.05) |

## 测试

```bash
# 运行所有测试
pnpm test lib/effect-validation/

# 运行特定测试
pnpm test lib/effect-validation/__tests__/integration.test.ts
```
