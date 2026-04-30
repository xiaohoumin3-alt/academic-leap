# 效果验证系统 - 设计文档

**版本**: v1.0
**日期**: 2026-05-01
**状态**: Draft

---

## 一、系统目标

验证 AI 生成模板是否真的提升学生学习效果，实现：

1. **模板质量验证** - 单个 AI 生成模板是否比现有模板更好
2. **系统整体效果** - 模板工厂生成的模板是否整体提升了推荐系统的 LE 指标
3. **持续监控** - 日常自动监控 + 重要决策前手动深度验证

---

## 二、核心指标

| 指标 | 目标 | 计算方式 |
|------|------|----------|
| LE（学习有效性） | ≥ 0.15 | P(correct \| after) - P(correct \| before) |
| DFI（数据链完整度） | ≥ 0.99 | trace_complete_events / total_events |
| 统计显著性 | p < 0.05 | 每组至少 50 样本 |
| 异常检测响应时间 | < 5 分钟 | 指标异常到降级完成 |

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    效果验证系统                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐  │
│  │  Shadow Mode │ ───→ │  A/B Testing │ ───→ │ Canary Roll│  │
│  │  影子收集器    │      │  实验管理器    │      │  灰度控制   │  │
│  └──────────────┘      └──────────────┘      └────────────┘  │
│          ↓                     ↓                    ↓          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   效果分析引擎                            │  │
│  │  • LE计算  • 统计显著性检验  • 异常检测                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│          ↓                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   决策控制器                              │  │
│  │  • 达标 → 全量发布  • 下降 → 优雅降级  • 数据不足 → 继续收集│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、组件设计

### 4.1 ShadowCollector（影子收集器）

**职责**：新模板上线后先在影子模式收集数据，不影响线上

**接口**：
```typescript
interface ShadowCollector {
  addToShadowPool(templateId: string): void;
  removeFromShadowPool(templateId: string): void;
  recordShadowAttempt(attempt: ShadowAttempt): void;
  isReadyForAnalysis(templateId: string): boolean;
  getSampleCount(templateId: string): number;
}
```

**数据模型**：
```typescript
model ShadowAttempt {
  id            String   @id @default(cuid())
  templateId    String
  userId        String
  knowledgePoint String
  isCorrect     Boolean
  duration      Int      // 秒
  leDelta       Float?   // 学习有效性增量
  recordedAt    DateTime @default(now())

  @@index([templateId])
  @@index([knowledgePoint])
}
```

### 4.2 ExperimentManager（实验管理器）

**职责**：管理 A/B 测试实验，分流用户，计算统计显著性

**接口**：
```typescript
interface ExperimentManager {
  createExperiment(config: ExperimentConfig): string;
  assignVariant(userId: string, experimentId: string): Variant;
  recordObservation(data: Observation): void;
  analyzeExperiment(experimentId: string): ExperimentResult;
  getExperimentStatus(experimentId: string): ExperimentStatus;
}
```

**数据模型**：
```typescript
model EffectExperiment {
  id              String   @id @default(cuid())
  name            String
  controlTemplateId String
  treatmentTemplateId String
  status          String   @default("draft")  // draft|running|paused|completed
  targetMetric    String   // 'accuracy' | 'le'
  minSampleSize   Int      @default(50)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  assignments     EffectAssignment[]
  observations    EffectObservation[]

  @@index([status])
}

model EffectAssignment {
  id            String   @id @default(cuid())
  experimentId  String
  userId        String
  variant       String   // 'control' | 'treatment'
  assignedAt    DateTime @default(now())

  experiment    EffectExperiment @relation(fields: [experimentId], references: [id])
  @@unique([experimentId, userId])
}

model EffectObservation {
  id            String   @id @default(cuid())
  experimentId  String
  userId        String
  variant       String
  metricName    String
  value         Float
  timestamp     DateTime @default(now())

  experiment    EffectExperiment @relation(fields: [experimentId], references: [id])

  @@index([experimentId, variant])
}
```

### 4.3 CanaryController（灰度控制器）

**职责**：控制新模板放量节奏

**接口**：
```typescript
interface CanaryController {
  startCanary(templateId: string): void;
  getCurrentTraffic(templateId: string): number;
  increaseTraffic(templateId: string, delta: number): void;
  checkHealth(templateId: string): HealthStatus;
  rollback(templateId: string): void;
  pause(templateId: string): void;
  resume(templateId: string): void;
}
```

**灰度阶段**：
```typescript
const CANARY_STAGES = [5, 10, 25, 50, 100];  // 百分比
const STAGE_DURATION_HOURS = 24;  // 每阶段最少运行24小时
const HEALTH_CHECK_INTERVAL_MINUTES = 5;  // 健康检查间隔
```

**数据模型**：
```typescript
model CanaryRelease {
  id            String   @id @default(cuid())
  templateId    String   @unique
  currentStage  Int      @default(0)  // 0-4，对应百分比
  trafficPercent Int     @default(0)
  status        String   @default("pending")  // pending|running|paused|completed|rolled_back
  startedAt     DateTime?
  lastHealthCheck DateTime?
  healthStatus String?  // healthy|warning|danger
  createdAt     DateTime @default(now())

  history       CanaryStageHistory[]

  @@index([templateId])
  @@index([status])
}

model CanaryStageHistory {
  id            String   @id @default(cuid())
  canaryId      String
  stage         Int
  trafficPercent Int
  enteredAt     DateTime @default(now())
  exitedAt     DateTime?
  leValue      Float?
  accuracyValue Float?

  canary        CanaryRelease @relation(fields: [canaryId], references: [id])
}
```

### 4.4 LEAnalyzer（学习有效性分析器）

**职责**：计算学习有效性，检测异常

**接口**：
```typescript
interface LEAnalyzer {
  calculateLE(knowledgePointId: string): Promise<LEResult>;
  calculateGlobalLE(): Promise<GlobalLEResult>;
  calculateUplift(experimentId: string): UpliftResult;
  detectAnomalies(): AnomalyReport[];
  generateReport(): ValidationReport;
}

interface LEResult {
  knowledgePointId: string;
  le: number;
  confidence: number;
  sampleSize: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface GlobalLEResult {
  le: number;
  confidence: number;
  trend: 'improving' | 'stable' | 'declining';
  byKnowledgePoint: LEResult[];
}

interface UpliftResult {
  controlMean: number;
  treatmentMean: number;
  uplift: number;  // 百分比
  pValue: number;
  significant: boolean;
  recommendation: 'promote' | 'demote' | 'need_more_data';
}
```

### 4.5 GracefulDegrader（优雅降级器）

**职责**：指标异常时自动降级到规则引擎

**接口**：
```typescript
interface GracefulDegrader {
  degrade(templateId: string, reason: string, severity: Severity): void;
  switchToRuleEngine(templateId: string): void;
  recover(templateId: string): void;
  getDegradationStatus(): DegradationStatus[];
}

type Severity = 'warning' | 'danger' | 'critical';

interface DegradationStatus {
  templateId: string;
  status: 'healthy' | 'warning' | 'degraded' | 'stopped';
  currentStrategy: 'rl' | 'rule_engine';
  degradationReason?: string;
  degradedAt?: DateTime;
}
```

**降级规则**：
```typescript
const DEGRADATION_RULES = {
  le_drop_10_percent: {
    severity: 'warning',
    action: 'increase_exploration',
    description: 'LE 下降 10%，增加探索比例'
  },
  le_drop_20_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: 'LE 下降 20%，降级到规则引擎'
  },
  le_drop_30_percent: {
    severity: 'critical',
    action: 'immediate_rollback',
    description: 'LE 下降 30%，立即回滚'
  },
  accuracy_drop_15_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: '正确率下降 15%，降级到规则引擎'
  }
};
```

---

## 五、数据流

### 5.1 新模板上线流程

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

### 5.2 持续监控流程

```
定时任务 (每5分钟)
       ↓
1. 检查所有活跃 Canary 状态
       ↓
2. 计算 LE 和准确率
       ↓
3. 与基线对比
       ↓
4. 异常检测
       ↓
5. 根据规则执行降级/告警
```

---

## 六、API 端点

### 6.1 Dashboard

```
GET /api/effect-validation/dashboard
Response: {
  activeCanaries: CanaryRelease[];
  activeExperiments: EffectExperiment[];
  globalLE: GlobalLEResult;
  anomalies: AnomalyReport[];
}
```

### 6.2 Experiment Management

```
GET    /api/effect-validation/experiments
POST   /api/effect-validation/experiments
GET    /api/effect-validation/experiments/:id
GET    /api/effect-validation/experiments/:id/results
PATCH  /api/effect-validation/experiments/:id/status
```

### 6.3 Canary Management

```
GET    /api/effect-validation/canaries
POST   /api/effect-validation/canaries
GET    /api/effect-validation/canaries/:templateId
POST   /api/effect-validation/canaries/:templateId/increase
POST   /api/effect-validation/canaries/:templateId/rollback
POST   /api/effect-validation/canaries/:templateId/pause
```

### 6.4 LE Reporting

```
GET    /api/effect-validation/le
GET    /api/effect-validation/le/:knowledgePointId
GET    /api/effect-validation/report
```

---

## 七、验收标准

### 7.1 功能验收

- [ ] 新模板自动进入 Shadow Mode
- [ ] Shadow 模式下收集 ≥50 样本后自动创建 A/B 实验
- [ ] A/B 实验支持统计显著性检验 (p < 0.05)
- [ ] Canary 灰度支持 5 个阶段
- [ ] LE 下降 20% 自动降级到规则引擎
- [ ] Dashboard 实时显示所有指标

### 7.2 性能验收

| 指标 | 目标 |
|------|------|
| Dashboard 响应时间 | < 500ms |
| 异常检测延迟 | < 5 分钟 |
| 降级执行时间 | < 30 秒 |

### 7.3 数据验收

- [ ] 所有学习事件有唯一 eventId
- [ ] DFI ≥ 0.99
- [ ] 实验数据保留 90 天

---

## 八、依赖关系

**依赖**：
- `lib/rl/validation/le.ts` - LE 计算逻辑
- `lib/rl/health/` - 健康监控
- `apps/prediction-service/ab-testing.ts` - A/B 测试框架

**被依赖**：
- `lib/template-factory/` - 模板工厂使用效果验证
- `app/api/rl/` - RL 系统使用效果验证

---

## 九、后续扩展

**Phase 2**：
- 多指标联合分析
- 自动调参优化
- 历史实验对比

**Phase 3**：
- 用户分群效果分析
- 长周期学习效果追踪
- 模板迭代优化
