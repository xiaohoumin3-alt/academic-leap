# v1.0 Production Architecture

**日期**: 2026-04-26
**状态**: 工程可落地版本
**原则**: 生产系统与科研模块隔离

---

## 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Research Sandbox (隔离)                        │
│  Full SCM • Falsifiability • Equivalence Classes         │
│  → 不直接服务生产，独立验证和迭代                         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Interpretability (增强)                        │
│  Features • Weak Causal Signals • Explanations           │
│  → 提供可解释性，不承诺强因果结论                         │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Prediction Engine (必须)                       │
│  Accuracy • Reliability • Performance                    │
│  → 核心预测能力，生产决策的唯一依据                       │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Prediction Engine (必须)

**职责**: 准确预测学生答题表现

### 输入
```typescript
interface PredictionInput {
  studentId: string;
  questionId: string;
  // 题目特征
  questionFeatures: {
    difficulty: number;      // 难度
    discrimination: number;  // 区分度
    knowledgeNodes: string[]; // 涉及知识点
  };
  // 学生历史
  studentHistory: {
    recentAnswers: Array<{ correct: boolean; questionId: string }>;
    timeSpent: number[];
  };
}
```

### 输出
```typescript
interface PredictionOutput {
  probability: number;        // 答对概率 [0, 1]
  confidence: number;         // 置信度 [0, 1]
  reasoning: string | null;   // 可选解释
}
```

### 模型选择（按复杂度）

**选项 A: 简单统计**（推荐作为 MVP）
```typescript
function predictCorrectness(input: PredictionInput): PredictionOutput {
  // IRT 模型 + 时间衰减
  const recentCorrect = input.studentHistory.recentAnswers
    .slice(-20)
    .filter(a => a.correct).length;

  const baseProb = recentCorrect / Math.min(20, input.studentHistory.recentAnswers.length);

  // 题目难度调整
  const adjustedProb = baseProb * (1 - input.questionFeatures.difficulty * 0.3);

  return {
    probability: Math.max(0.1, Math.min(0.9, adjustedProb)),
    confidence: 0.7,
    reasoning: null
  };
}
```

**选项 B: 机器学习**
```typescript
// 使用轻量级模型（如逻辑回归、XGBoost）
// 特征：历史正确率、平均用时、题目难度、知识点覆盖率
// 训练：离线批处理，定期更新模型
```

### 验证标准
- 预测准确率 > 70%
- 置信度校准（predicted 70% ≈ actual 70%）
- 响应时间 < 100ms

---

## Layer 2: Interpretability (增强)

**职责**: 提供可解释的特征和信号，**不承诺强因果**

### 2.1 能力估计（Feature）

```typescript
interface AbilityEstimate {
  nodeId: string;           // 知识点 ID
  ability: number;          // 能力值 [0, 1]
  sampleSize: number;       // 样本数
  lastUpdated: number;      // 更新时间
  confidence: number;       // 估计置信度
}

function estimateAbility(
  studentHistory: AnswerHistory[],
  nodeId: string
): AbilityEstimate {
  const relevantAnswers = studentHistory.filter(
    a => a.question.knowledgeNodes.includes(nodeId)
  );

  if (relevantAnswers.length < 3) {
    return {
      nodeId,
      ability: 0.5,
      sampleSize: relevantAnswers.length,
      lastUpdated: Date.now(),
      confidence: 0.1
    };
  }

  const correctRate = relevantAnswers.filter(a => a.correct).length / relevantAnswers.length;

  // 时间衰减：最近的答案权重更高
  const now = Date.now();
  let weightedSum = 0;
  let weightSum = 0;

  for (const answer of relevantAnswers) {
    const age = (now - answer.timestamp) / (30 * 24 * 60 * 60 * 1000); // 天
    const weight = Math.exp(-age / 30); // 30天半衰期
    weightedSum += (answer.correct ? 1 : 0) * weight;
    weightSum += weight;
  }

  return {
    nodeId,
    ability: weightedSum / weightSum,
    sampleSize: relevantAnswers.length,
    lastUpdated: now,
    confidence: Math.min(0.9, relevantAnswers.length / 20)
  };
}
```

### 2.2 弱因果信号（Weak Causal Signals）

**注意**: 这些信号只是"提示"，不是因果结论

```typescript
interface WeakCausalSignals {
  conditionalIndependence: Array<{
    x: string;      // 变量 X
    y: string;      // 变量 Y
    z: string;      // 条件变量 Z
    pValue: number; // 独立性检验 p-value
    interpretation: string; // 解释
  }>;
  interventionCorrelation: Array<{
    action: string;     // "学习知识点X"
    outcome: string;    // "X正确率提升"
    correlation: number; // 相关性
    sampleSize: number;
  }>;
}

function computeWeakSignals(studentHistory: AnswerHistory[]): WeakCausalSignals {
  return {
    conditionalIndependence: [
      {
        x: "responseTime",
        y: "correctness",
        z: "ability",
        pValue: 0.03,
        interpretation: "控制能力后，答题时间与正确率弱相关"
      }
    ],
    interventionCorrelation: [
      {
        action: "学习勾股定理",
        outcome: "勾股定理题正确率",
        correlation: 0.34,
        sampleSize: 156,
        interpretation: "正相关性，但不承诺因果"
      }
    ]
  };
}
```

### 2.3 解释生成

```typescript
interface Explanation {
  primaryReason: string;     // 主要原因
  supportingFactors: string[]; // 支持因素
  confidence: number;        // 解释置信度
  caveats: string[];         // 注意事项
}

function generateExplanation(
  prediction: PredictionOutput,
  ability: AbilityEstimate[],
  signals: WeakCausalSignals
): Explanation {
  return {
    primaryReason: `该学生在相关知识点${ability[0].nodeId}的能力为${ability[0].ability.toFixed(2)}`,
    supportingFactors: [
      `基于${ability[0].sampleSize}道题的历史数据`,
      `最近表现趋势：${ability[0].ability > 0.6 ? '上升' : '平稳'}`
    ],
    confidence: ability[0].confidence,
    caveats: [
      "能力估计基于统计相关性，不构成因果结论",
      "样本量较小时估计不稳定"
    ]
  };
}
```

---

## Layer 3: Research Sandbox (隔离)

**职责**: 完整因果模型研究，**不直接服务生产**

### 3.1 SCM 实现

```typescript
// 完整的结构因果模型（用于研究）
class ResearchSCM {
  // Z: 潜在状态（能力、努力度、注意力）
  // X: 行为（答题时间、是否跳过）
  // Y: 结果（正确性）
  // U: 外生噪声

  computeCounterfactual(
    factual: Observation,
    intervention: Intervention
  ): CounterfactualResult {
    // Pearl 三步：Abduction → Action → Prediction
    // 完整实现，仅供研究使用
  }
}
```

### 3.2 可证伪性验证

```typescript
class FalsificationValidator {
  // 生成"杀模型"的观测
  generateKillingObservations(model: Model): Observation[] {
    // 实现可证伪性测试
  }

  // 验证模型是否可证伪
  isFalsifiable(model: Model): boolean {
    // 检查模型能否被观测证伪
  }
}
```

### 3.3 等价类分析

```typescript
class EquivalenceClassAnalyzer {
  // 计算干预等价类
  computeEquivalenceClass(models: Model[]): EquivalenceClass[] {
    // 实现：[M] = { M | ∀ do(X): P₁(Y|do(X)) = P₂(Y|do(X)) }
  }

  // 提取可识别效应
  extractIdentifiableEffects(eqClass: EquivalenceClass): Map<string, number> {
    // 实现等价类内不变量提取
  }
}
```

### 研究输出

```typescript
interface ResearchOutput {
  insights: string[];              // 研究洞察
  recommendations: string[];       // 对生产的建议
  validationResults: {             // 验证结果
    internalConsistency: boolean;
    externalValidity: boolean;
    falsifiability: boolean;
  };
}
```

---

## 层间交互协议

### Layer 1 → Layer 2

```typescript
// Layer 1 提供预测数据给 Layer 2 生成解释
const prediction = predictionEngine.predict(input);
const explanation = interpretabilityLayer.explain(prediction, studentHistory);
```

### Layer 3 → Layer 1/2

```typescript
// Layer 3 提供研究洞察，但不直接控制生产
const researchOutput = researchSandbox.analyze(allData);

if (researchOutput.validationResults.falsifiability) {
  // 模型可证伪，可以信任其弱因果信号
  interpretabilityLayer.updateSignals(researchOutput.insights);
}

// 研究建议经过人工审核后才应用到生产
if (humanApproval(researchOutput.recommendations)) {
  predictionEngine.updateModel(researchOutput.recommendations);
}
```

---

## 验证标准

### Layer 1（必须）
- [ ] 预测准确率 > 70%
- [ ] 置信度校准良好
- [ ] 响应时间 < 100ms
- [ ] 生产稳定性 > 99.9%

### Layer 2（增强）
- [ ] 能力估计与观测一致
- [ ] 解释有直觉意义
- [ ] 弱因果信号标注清晰

### Layer 3（隔离）
- [ ] 内部一致性验证通过
- [ ] 外部有效性验证通过
- [ ] 可证伪性验证通过
- [ ] **不直接参与生产决策**

---

## 实施路线

### Phase 1: MVP（2周）
- 实现 Layer 1 Prediction Engine（简单统计版本）
- 基础能力估计（IRT）
- 生产部署

### Phase 2: 增强解释性（2周）
- 实现 Layer 2 Interpretability
- 弱因果信号计算
- 解释生成

### Phase 3: 研究验证（持续）
- 实现 Layer 3 Research Sandbox
- 可证伪性验证
- 等价类分析
- 定期输出研究洞察

---

## 关键原则

1. **生产与科研隔离**: Layer 3 不直接控制生产
2. **渐进增强**: Layer 1 必须稳定可靠，Layer 2/3 逐步添加
3. **透明性**: 弱因果信号必须标注"不承诺因果"
4. **人工审核**: 研究建议经人工审核后才应用

---

**文档版本**: v1.0-production
**状态**: 工程可落地架构设计
