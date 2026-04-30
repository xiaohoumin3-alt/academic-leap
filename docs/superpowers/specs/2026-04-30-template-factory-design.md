# 智能模板扩展系统 - 设计文档

**版本**: v1.0
**日期**: 2026-04-30
**作者**: Claude
**状态**: Draft

---

## 一、系统目标

将题目模板从 **~40个** 扩展到 **覆盖所有知识点**，同时保证：
- 数学正确性：100%
- 教学有效性：每个模板有明确学习目标
- 完整性：题目+解析+知识点+难度分级
- 可追溯：每个模板有生成和验证记录

---

## 二、验收标准（高质量上线）

### 2.1 模板质量标准

| 指标 | 标准 | 验证方法 |
|------|------|----------|
| **数学正确性** | 100% | LLM验证 + 人工抽查10% |
| **答案解析正确** | 100% | LLM验证 + 自动计算验证 |
| **知识点对应准确** | ≥95% | 知识点分类器验证 |
| **难度分级准确** | ≥90% | 与学生答题数据对比 |
| **教学有效性** | ≥85% | 人工评分 + 学生反馈 |
| **模板多样性** | 每个知识点≥3个模板 | 统计验证 |

### 2.2 系统验收标准

```
✅ 所有知识点(非叶子节点)都有对应模板
✅ 每个知识点至少有3个不同结构的模板
✅ 所有模板通过LLM双重验证
✅ 低分模板(<80分)完成人工审核
✅ 生成1000道题目，错误率<1%
✅ 学生使用后，推荐准确率>75%
```

### 2.3 性能标准

| 指标 | 目标 |
|------|------|
| 单个模板生成时间 | < 30秒 |
| 单个模板验证时间 | < 15秒 |
| 批量生成100个模板 | < 10分钟 |
| 题目生成响应时间 | < 2秒 |

---

## 三、系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           模板工厂系统                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐      ┌──────────────────┐      ┌─────────────────┐ │
│  │   需求发现层      │      │    生成层        │      │    验证层        │ │
│  ├──────────────────┤      ├──────────────────┤      ├─────────────────┤ │
│  │ • GapDetector    │ ───→ │ • TemplateGen    │ ───→ │ • TemplateVal    │ │
│  │ • CoverageTracker│      │ • LLM Orchestrator│      │ • MathValidator  │ │
│  │ • PriorityCalc   │      │ • PromptManager  │      │ • PedagogyVal    │ │
│  └──────────────────┘      └──────────────────┘      └─────────────────┘ │
│           ↓                         ↓                         ↓            │
│  ┌──────────────────┐      ┌──────────────────┐      ┌─────────────────┐ │
│  │   质量评估层      │      │    人工审核层     │      │    持续优化层    │ │
│  ├──────────────────┤      ├──────────────────┤      ├─────────────────┤ │
│  │ • QualityScorer  │ ───→ │ • ReviewQueue    │ ───→ │ • FeedbackLoop   │ │
│  │ • RiskClassifier │      │ • ReviewUI       │      │ • PerformanceTrk │ │
│  │ • AutoApprover   │      │ • AuditLog       │      │ • TemplateOpt   │ │
│  └──────────────────┘      └──────────────────┘      └─────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                           现有系统集成                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  • Template表 (扩展)                                                      │
│  • Question生成流程 (复用)                                                 │
│  • 管理后台UI (扩展)                                                     │
│  • RL推荐系统 (输入更多题目)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件设计

#### 组件1: GapDetector（需求发现）

**职责**：发现哪些知识点缺少模板

```typescript
interface KnowledgeGap {
  knowledgePointId: string;
  knowledgePointName: string;
  currentTemplateCount: number;
  targetTemplateCount: number;  // 最少3个
  gap: number;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
}
```

**逻辑**：
1. 遍历所有知识点
2. 统计每个知识点的模板数量
3. 计算缺口 = target - current
4. 按缺口大小和知识点重要性排序

**输出**：优先级队列，指导TemplateGenerator

---

#### 组件2: TemplateGenerator（模板生成）

**职责**：使用LLM生成高质量模板

**输入**：
```typescript
interface GenerationRequest {
  knowledgePoint: KnowledgePoint;
  targetStructure: StructureType[];
  targetDepth: DepthLevel[];
  count: number;  // 生成数量
  context: {
    textbook: string;
    grade: number;
    relatedConcepts: string[];
  };
}
```

**生成流程**：
```
1. 构建Prompt（包含知识点定义、教学目标、示例）
2. 调用LLM（GPT-4或Claude）
3. 解析输出为结构化模板
4. 初步筛选明显错误的
5. 返回候选模板列表
```

**Prompt模板**：
```
你是一个数学教育专家。请为以下知识点生成{count}个题目模板：

知识点：{knowledgePointName}
定义：{definition}
教学目标：{learningObjective}
年级：{grade}

要求：
1. 模板结构为：{structure}，深度为：{depth}
2. 使用{param}占位符表示参数
3. 包含constraint约束条件
4. 提供详细的解题步骤
5. 标注难度等级和认知负荷
6. 关联相关的数学概念

输出JSON格式：
{
  "templates": [
    {
      "name": "模板名称",
      "template": "题目模板",
      "answer": "答案模板",
      "params": {"a": "range", "b": "range"},
      "constraint": "约束条件",
      "steps": ["步骤1", "步骤2"],
      "hint": "提示",
      "difficulty": 1-5,
      "cognitiveLoad": 0-1,
      "reasoningDepth": 0-1,
      "learningObjective": "学习目标",
      "concepts": ["相关概念"]
    }
  ]
}
```

---

#### 组件3: TemplateValidator（模板验证）

**职责**：使用LLM验证模板质量

**双重验证**：

**验证器A：数学正确性验证**
```
检查项：
- 答案计算是否正确
- 参数约束是否完整
- 边界条件是否考虑
- 特殊情况是否处理
```

**验证器B：教学有效性验证**
```
检查项：
- 题目是否符合教学目标
- 难度标注是否合理
- 步骤是否清晰
- 提示是否有帮助
- 概念关联是否准确
```

**输出**：
```typescript
interface ValidationResult {
  templateId: string;
  mathCorrectness: {
    passed: boolean;
    issues: string[];
    confidence: number;  // 0-1
  };
  pedagogyQuality: {
    passed: boolean;
    issues: string[];
    score: number;  // 0-100
  };
  overallScore: number;  // 0-100
  recommendation: 'approve' | 'review' | 'reject';
}
```

---

#### 组件4: QualityScorer（质量评分）

**职责**：综合多个维度给出模板质量分数

**评分维度**：
```typescript
interface QualityScore {
  mathCorrectness: number;      // 权重 40%
  pedagogyQuality: number;       // 权重 30%
  difficultyAccuracy: number;    // 权重 15%
  completeness: number;          // 权重 10%
  innovation: number;            // 权重 5%
  // 总分
  overall: number;               // 0-100
}
```

**自动批准规则**：
```
overall >= 90 && mathCorrectness === 100 → 自动批准
overall >= 80 && mathCorrectness === 100 → 进入快速审核队列
overall < 80 → 进入详细审核队列
mathCorrectness < 100 → 直接拒绝
```

---

#### 组件5: HumanReviewQueue（人工审核）

**职责**：为低分模板提供人工审核界面

**审核队列优先级**：
```
P0: mathCorrectness < 100%（必须处理）
P1: 70 <= overall < 80（高风险）
P2: 80 <= overall < 90（中风险）
P3: overall >= 90（抽查）
```

**审核界面功能**：
- 显示模板完整信息
- 显示LLM验证发现的问题
- 一键批准/拒绝/修改
- 审核历史记录
- 批量操作

---

### 3.3 数据模型扩展

#### 扩展Template表

```sql
ALTER TABLE Template ADD COLUMN:
  -- 生成相关
  generatedBy     TEXT    DEFAULT 'manual',  -- 'manual' | 'ai'
  generatorModel  TEXT,                       -- 'gpt-4' | 'claude-3'
  generationPrompt TEXT,                      -- 生成用prompt

  -- 验证相关
  validatedBy      TEXT,                      -- 'ai' | 'human'
  validationResult JSON,                       -- 验证结果
  qualityScore    INTEGER,                    -- 0-100
  autoApproved    BOOLEAN DEFAULT false,

  -- 质量跟踪
  usedCount       INTEGER DEFAULT 0,
  errorCount      INTEGER DEFAULT 0,
  errorRate       FLOAT,                       -- 错误率

  -- 状态
  reviewStatus    TEXT    DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewedBy      TEXT,
  reviewedAt      DATETIME,
  reviewNotes     TEXT
```

#### 新增表

```sql
-- 模板生成历史
CREATE TABLE TemplateGeneration (
  id              TEXT PRIMARY KEY,
  knowledgePointId TEXT,
  generatorModel  TEXT,
  prompt          TEXT,
  rawOutput       TEXT,
  generatedCount  INTEGER,
  successCount    INTEGER,
  createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模板验证历史
CREATE TABLE TemplateValidation (
  id              TEXT PRIMARY KEY,
  templateId      TEXT,
  validatorModel  TEXT,
  validationType  TEXT,  -- 'math' | 'pedagogy'
  result          JSON,
  score           INTEGER,
  passed          BOOLEAN,
  createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 人工审核记录
CREATE TABLE TemplateReview (
  id              TEXT PRIMARY KEY,
  templateId      TEXT,
  reviewerId      TEXT,
  decision        TEXT,  -- 'approve' | 'reject' | 'modify'
  notes           TEXT,
  modifications   JSON,
  duration        INTEGER,  -- 审核用时(秒)
  createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 知识点覆盖追踪
CREATE TABLE KnowledgeCoverage (
  knowledgePointId TEXT PRIMARY KEY,
  targetTemplateCount INTEGER DEFAULT 3,
  currentTemplateCount INTEGER DEFAULT 0,
  gap             INTEGER,
  priority        TEXT,
  lastUpdated     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 四、API设计

### 4.1 模板生成API

```typescript
// POST /api/admin/factory/generate
interface GenerateTemplatesRequest {
  knowledgePointId: string;
  structures?: StructureType[];
  depths?: DepthLevel[];
  count: number;
  forceRegenerate?: boolean;
}

interface GenerateTemplatesResponse {
  generationId: string;
  status: 'started' | 'completed' | 'failed';
  templates: {
    id: string;
    name: string;
    template: string;
    validationResult: ValidationResult;
    needsReview: boolean;
  }[];
  summary: {
    total: number;
    approved: number;
    needsReview: number;
    rejected: number;
  };
}
```

### 4.2 模板验证API

```typescript
// POST /api/admin/factory/validate
interface ValidateTemplateRequest {
  template: QuestionTemplate;
  validationTypes: ('math' | 'pedagogy')[];
}

interface ValidateTemplateResponse {
  templateId: string;
  results: {
    math: ValidationResult;
    pedagogy: ValidationResult;
  };
  overallScore: number;
  recommendation: 'approve' | 'review' | 'reject';
}
```

### 4.3 审核队列API

```typescript
// GET /api/admin/factory/review-queue
interface GetReviewQueueRequest {
  priority?: 'p0' | 'p1' | 'p2' | 'p3';
  status?: 'pending' | 'approved' | 'rejected';
  limit?: number;
}

interface ReviewQueueItem {
  id: string;
  templateId: string;
  knowledgePoint: string;
  template: QuestionTemplate;
  validationResult: ValidationResult;
  priority: string;
  estimatedTime: number;  // 预计审核用时(秒)
}

// POST /api/admin/factory/review/:id/decision
interface ReviewDecisionRequest {
  decision: 'approve' | 'reject' | 'modify';
  notes?: string;
  modifications?: Partial<QuestionTemplate>;
}
```

### 4.4 覆盖报告API

```typescript
// GET /api/admin/factory/coverage
interface CoverageReport {
  total: number;
  covered: number;
  coverageRate: number;
  byKnowledgePoint: {
    id: string;
    name: string;
    current: number;
    target: number;
    gap: number;
    priority: string;
  }[];
  gaps: {
    high: number;
    medium: number;
    low: number;
  };
}
```

---

## 五、LLM编排策略

### 5.1 模型选择

| 任务 | 推荐模型 | 理由 |
|------|---------|------|
| 模板生成 | GPT-4 / Claude 3.5 Sonnet | 长文本理解，结构化输出 |
| 数学验证 | Claude 3.5 Sonnet | 数学推理能力强 |
| 教学验证 | GPT-4 | 教育理解好 |
| 快速筛选 | GPT-3.5 / Haiku | 成本低，速度快 |

### 5.2 并行策略

```
生成阶段：
- 知识点按优先级分批
- 每批5-10个知识点并行生成
- 每个知识点生成3个模板

验证阶段：
- 数学验证 + 教学验证并行
- 不同模板独立验证
- 失败任务自动重试3次
```

### 5.3 成本控制

```
预估成本（每100个模板）：
- 生成：GPT-4 × 100 × ~2000 tokens = $6
- 验证：Claude × 100 × 2 × ~1000 tokens = $3
- 总计：~$9/100模板

优化策略：
- 使用cache复用相似prompt
- 失败重试使用更便宜的模型
- 批量处理降低API调用次数
```

---

## 六、实施计划

### Phase 1: 基础设施（2周）

**目标**：搭建核心框架

```
Week 1:
- [ ] 扩展数据库表结构
- [ ] 实现GapDetector
- [ ] 实现TemplateGenerator基础版
- [ ] 设计Prompt模板

Week 2:
- [ ] 实现TemplateValidator
- [ ] 实现QualityScorer
- [ ] 实现ReviewQueue基础功能
- [ ] 编写单元测试
```

**验收**：能生成单个模板并完成验证

---

### Phase 2: 批量生成（2周）

**目标**：生成第一批模板

```
Week 3:
- [ ] 实现批量生成流程
- [ ] 实现并行处理
- [ ] 生成覆盖核心知识点的100个模板
- [ ] 完成自动验证

Week 4:
- [ ] 人工审核第一批模板
- [ ] 收集审核反馈
- [ ] 优化Prompt和验证规则
- [ ] 修复发现的bug
```

**验收**：100个模板上线，错误率<5%

---

### Phase 3: 质量优化（2周）

**目标**：提升模板质量

```
Week 5:
- [ ] 分析第一轮质量问题
- [ ] 优化Prompt模板
- [ ] 调整质量评分权重
- [ ] 生成第二批100个模板

Week 6:
- [ ] 完成第二批审核
- [ ] 对比两轮质量数据
- [ ] 建立质量基准线
- [ ] 文档化最佳实践
```

**验收**：200个模板上线，错误率<2%

---

### Phase 4: 全面覆盖（4-6周）

**目标**：覆盖所有知识点

```
Week 7-8:
- [ ] 批量生成剩余知识点模板
- [ ] 建立自动化监控
- [ ] 处理边缘知识点

Week 9-10:
- [ ] 完成所有模板审核
- [ ] 质量抽查
- [ ] 修复问题模板

Week 11-12:
- [ ] 全量测试
- [ ] 性能优化
- [ ] 文档完善
```

**验收**：所有知识点覆盖，满足全部验收标准

---

## 七、风险与应对

### 风险1: LLM生成质量不稳定

**应对**：
- 双重验证机制
- 人工审核低分模板
- 持续优化Prompt
- 建立质量基准线

### 风险2: 成本超支

**应对**：
- 使用缓存减少重复生成
- 分批生成，及时调整
- 优先处理高价值知识点
- 监控成本，设置预算上限

### 风险3: 人工审核瓶颈

**应对**：
- 优先级队列确保关键模板先审
- 提供批量操作工具
- 逐步提高自动批准阈值
- 必要时增加审核人力

### 风险4: 与现有系统集成问题

**应对**：
- 复用现有Template表结构
- 保持API兼容性
- 渐进式替换
- 充分测试

---

## 八、成功指标

### 短期（3个月/Phase 1-3完成）

| 指标 | 目标 |
|------|------|
| 模板总数 | > 500 |
| 知识点覆盖率 | > 80% |
| 平均每知识点模板数 | > 3 |
| 模板错误率 | < 2% |
| 自动批准率 | > 60% |

### 长期（Phase 4完成/约6个月）

| 指标 | 目标 |
|------|------|
| 模板总数 | > 1000 |
| 知识点覆盖率 | 100% |
| 平均每知识点模板数 | > 5 |
| 模板错误率 | < 1% |
| 自动批准率 | > 80% |
| 学生推荐准确率 | > 75% |

---

## 九、效果验证系统（上线就绪验证）

**核心问题**：模板数量足够后，如何验证产品真的达到上线标准？

**答案**：不能仅靠模板质量评分，必须通过**真实学生数据**验证三大核心KPI。

### 9.1 验证系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         效果验证系统                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐      ┌──────────────────┐      ┌─────────────────┐ │
│  │   小规模验证      │      │    A/B测试       │      │   伪收敛监控     │ │
│  │   (Canary)       │      │   (Control)      │      │  (Monitor)      │ │
│  ├──────────────────┤      ├──────────────────┤      ├─────────────────┤ │
│  │ • 50-100学生     │ ───→ │ • 新vs旧模板     │ ───→ │ • LE/CS监控     │ │
│  │ • 核心知识点     │      │ • 对照组设计     │      │ • 实时告警      │ │
│  │ • 2周观察期      │      │ • 统计显著性     │      │ • 自动降级      │ │
│  └──────────────────┘      └──────────────────┘      └─────────────────┘ │
│           ↓                         ↓                         ↓            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         上线决策引擎                                  │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  LaunchScore = w1×LE + w2×CS + w3×DFI + w4×HumanCheck                │ │
│  │  LaunchScore >= 85 分 → 上线                                           │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 三阶段验证流程

#### Phase 1: 小规模金丝雀验证（Canary Test）

**目的**：在小规模真实学生中验证新模板不会造成负面影响

**设计**：
```typescript
interface CanaryConfig {
  // 学生样本
  sampleSize: 50-100;  // 新用户随机分配
  duration: "2weeks";

  // 知识点范围
  knowledgePoints: "核心20%";  // 覆盖80%使用场景的核心知识点

  // 对比基准
  baseline: {
    oldTemplateAccuracy: number;  // 旧模板准确率
    oldRecommendationAccuracy: number;  // 旧推荐准确率
  };

  // 验证指标
  metrics: {
    LE_delta: "新LE - 旧LE";  // 期望 >= 0
    CS_delta: "新CS - 旧CS";  // 期望 >= 0
    error_rate: "题目错误率";  // 期望 < 2%
    engagement: "完成率";      // 期望不下降
  };
}
```

**通过标准**：
- 新模板组 LE >= 旧模板组 LE（不退化）
- 题目错误率 < 2%
- 没有严重负面反馈

**失败处理**：回滚到旧模板，分析原因，优化后重试

---

#### Phase 2: A/B对照测试（Controlled Experiment）

**目的**：在统计学层面验证新模板带来的提升

**设计**：
```typescript
interface ABTestConfig {
  // 分组
  groups: {
    control: "旧模板系统";
    treatment: "新模板系统";
  };

  // 样本量计算（统计显著性）
  sampleSize: {
    min: 300;  // 每组至少300学生
    power: 0.8;  // 80%统计功效
    significance: 0.05;  // 95%置信度
  };

  // 测试周期
  duration: "4weeks";

  // 核心假设
  hypotheses: [
    "H1: 新模板组LE > 旧模板组LE",
    "H2: 新模板组CS >= 旧模板组CS",
    "H3: 新模板组推荐准确率 > 旧模板组"
  ];
}
```

**评估指标**：

| 指标 | 计算方式 | 目标 |
|------|----------|------|
| **LE提升** | (新LE - 旧LE) / 旧LE | > 10% |
| **CS保持** | 新CS >= 旧CS - 0.05 | 不显著退化 |
| **推荐准确率** | 推荐题目的学生正确率 | > 75% |
| **伪收敛率** | LE<5% 且 CS>85% 的比例 | < 5% |

**统计检验**：
- 使用t检验验证LE差异显著性（p < 0.05）
- 使用卡方检验验证推荐准确率差异

---

#### Phase 3: 全量监控（Production Monitoring）

**目的**：上线后持续监控，及时发现问题

**实时监控指标**：
```typescript
interface ProductionMetrics {
  // 实时KPI
  realtime: {
    LE: "rolling_7days";
    CS: "rolling_7days";
    DFI: "rolling_7days";
    recommendationAccuracy: "rolling_7days";
  };

  // 告警阈值
  alerts: {
    LE_drop: "LE < 0.10";  // 低于目标15%
    CS_drop: "CS < 0.80";
    error_rate: "题目错误率 > 5%";
    pseudo_convergence: "LE<0.05 且 CS>0.85";
  };

  // 自动降级
  degradation: {
    trigger: "任一告警触发";
    action: "切回旧模板系统";
    notification: "立即通知团队";
  };
}
```

### 9.3 伪收敛检测与治理

**问题定义**：CS看起来很好（>85%），但LE很差（<5%），说明推荐"稳定但无效"

**检测机制**：
```typescript
interface PseudoConvergenceDetector {
  // 检测条件
  conditions: {
    low_LE: "LE < 0.05";  // 几乎没有学习提升
    high_CS: "CS > 0.85"; // 但推荐很稳定
    confidence: "持续1周以上";
  };

  // 根因分析
  rootCauseAnalysis: [
    "模板难度与学生水平不匹配",
    "推荐陷入局部最优（重复推荐相似题）",
    "知识点标签错误",
    "题目质量低（有歧义/错误）"
  ];

  // 治理措施
  remedies: [
    "降低RL探索率，增加多样性",
    "触发难度重新校准",
    "人工审查知识点标签",
    "暂停推荐，切换到规则引擎"
  ];
}
```

**监控仪表板**：
```
伪收敛热力图：
┌─────────────────────────────────────┐
│ 知识点   │ CS   │ LE   │ 状态      │
├─────────────────────────────────────┤
│ 分数加法   │ 92%  │ 3%   │ ⚠️ 伪收敛 │
│ 乘法分配律 │ 88%  │ 18%  │ ✅ 健康   │
│ 方程求解   │ 95%  │ 12%  │ ⚠️ 边界   │
└─────────────────────────────────────┘
```

### 9.4 上线就绪决策公式

**LaunchScore 计算**：
```typescript
interface LaunchScore {
  // 各维度得分（0-100）
  dimensions: {
    templateQuality: number;  // 模板质量评分（来自三、四节）
    LE_validated: number;     // LE验证得分
    CS_validated: number;     // CS验证得分
    coverage: number;         // 知识点覆盖率
    pseudoConvergenceControl: number;  // 伪收敛控制
  };

  // 权重分配
  weights: {
    templateQuality: 0.20;
    LE_validated: 0.35;      // 最高权重
    CS_validated: 0.25;
    coverage: 0.10;
    pseudoConvergenceControl: 0.10;
  };

  // 总分
  overall: number;  // 加权平均

  // 决策阈值
  decision: {
    ">= 90": "自动上线";
    ">= 85": "人工审核后上线";
    ">= 75": "需要优化后重新验证";
    "< 75": "不建议上线";
  };
}
```

**计算示例**：
```
LaunchScore =
  0.20 × 92  // 模板质量：优秀
  + 0.35 × 88  // LE验证：A/B测试显示12%提升
  + 0.25 × 90  // CS验证：稳定在87%
  + 0.10 × 100 // 覆盖率：100%
  + 0.10 × 85  // 伪收敛控制：有监控机制

= 90.85 分 → 自动上线
```

### 9.5 上线后持续优化

**反馈循环**：
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           持续优化闭环                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  学生作答数据 → LE/CS/DFI计算 → 问题识别 → 根因分析 → 优化措施        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│           ↓                              ↑                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                   优化措施执行                                         │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │  • 低质量模板下架                                                     │ │
│  │  • 高价值模板增加权重                                                │ │
│  │  • 伪收敛知识点触发重新校准                                          │ │
│  │  • 新模板补充生成                                                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**优化触发条件**：
- 某知识点LE < 10%：触发模板重新审核
- 某模板错误率 > 5%：自动下架
- 检测到伪收敛：增加探索率
- 推荐准确率 < 70%：切换到规则引擎兜底

---

## 十、最终验收：上线就绪检查清单

### 10.1 模板层验收

| 检查项 | 标准 | 状态 |
|--------|------|------|
| 模板总数 | > 1000 | □ |
| 知识点覆盖率 | 100% | □ |
| 平均每知识点模板数 | > 5 | □ |
| 模板错误率 | < 1% | □ |
| 自动批准率 | > 80% | □ |
| 质量评分平均分 | > 85 | □ |

### 10.2 效果验证验收

| 检查项 | 标准 | 状态 |
|--------|------|------|
| 小规模金丝雀通过 | LE不退化，错误率<2% | □ |
| A/B测试显著提升 | LE提升>10%，p<0.05 | □ |
| 伪收敛监控就绪 | 检测+治理机制完备 | □ |
| LaunchScore | >= 85分 | □ |

### 10.3 产品KPI验收（最终上线标准）

| 核心KPI | 目标 | 实测 | 状态 |
|---------|------|------|------|
| **LE（学习有效性）** | > 15% | ___% | □ |
| **CS（收敛稳定性）** | > 85% | ___% | □ |
| **DFI（数据完整度）** | > 99% | ___% | □ |
| **推荐准确率** | > 75% | ___% | □ |
| **伪收敛率** | < 5% | ___% | □ |

### 10.4 工程验收

| 检查项 | 标准 | 状态 |
|--------|------|------|
| 降级机制测试 | 触发条件→自动切回 | □ |
| 告警系统测试 | 异常→通知→记录 | □ |
| 性能测试 | 1000并发<2s响应 | □ |
| 安全测试 | 无SQL注入/XSS | □ |

---

## 十一、回答核心问题

**Q: 这个做完，产品就达到上线标准了吗？**

**A: 是的，但需要通过三阶段验证：**

1. **Phase 1-4完成** → 模板数量和质量达标（~6个月）
2. **金丝雀验证通过** → 小规模学生无负面反馈（2周）
3. **A/B测试通过** → 统计学验证LE显著提升（4周）
4. **LaunchScore >= 85** → 综合评分达标

**只有当以上四个条件全部满足时，产品才算达到上线标准。**

---

## 十二、风险与应对（补充）

### 风险5: A/B测试显示LE无提升

**应对**：
- 分析具体哪些知识点LE低
- 检查模板难度是否匹配
- 检查推荐算法是否正确
- 必要时回滚到旧模板

### 风险6: 上线后出现伪收敛

**应对**：
- 实时监控LE/CS指标
- 触发自动降级到规则引擎
- 人工审查问题知识点
- 优化后重新上线
