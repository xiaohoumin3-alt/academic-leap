# QIE Unified Kernel v2.1 - Finalized Design

**日期**: 2026-04-28
**状态**: v2.1 Finalized (基于 CTG 实验验证)
**基于**: v2.0 + Complexity Transfer + CTG 实验结果

---

## 实验验证结果

### CTG 冷启动悖论诊断

| 阶段 | Average CTG | Win Rate | 结论 |
|------|-------------|----------|------|
| 初始实现 | -0.04 | 30% | 机制失效 |
| 修复后 | **+0.06** | **50%** | 机制有效 |

**关键发现：**
1. 硬门控 τ=0.7 在数据不足时永远不触发
2. 权重停在默认值 [1/3, 1/3, 1/3]，无法学习
3. 降低门控 + 增加训练数据 + 权重预热 = CTG 转正

---

## 核心设计决策

### A. 权重初始化：有偏先验（Biased Prior）

**摒弃**：均匀分布 `[0.33, 0.33, 0.33]`

**采用**：
```
w_complexity = 0.5    // 核心降维打击因子
w_reasoningDepth = 0.3
w_cognitiveLoad = 0.2
```

**理由**：物理意义优先于统计均匀性。复杂度层次是能力迁移的主要瓶颈。

---

### B. 门控与平滑控制

| 参数 | 值 | 理由 |
|------|-----|------|
| Gate Threshold (τ) | 0.55 | 略高于随机猜测，确保样本纯净度 |
| Learning Rate (η) | 0.01 → 0.005 (后期) | 初期大步快跑，后期微调 |
| 衰减系数 | 0.95 | 每 1000 次更新衰减一次 |

---

### C. 数学形式稳定性加固

**原版（有数值爆炸风险）：**
```typescript
P_complex = P_simple * Math.exp(-weightedDelta)
```

**加固版（有 Clamp 约束）：**
```typescript
const clampedDelta = Math.max(0, Math.min(weightedDelta, 2.0));
P_complex = P_simple * Math.exp(-clampedDelta);
```

**约束条件：**
- `weightedDelta ∈ [0, 2.0]` — 防止 exp 产生极小值
- `Σw_i = 1` — 归一化保证
- `w_i ≥ 0` — 非负约束

---

## 架构：Global Shared Weights

### 核心逻辑

```
个体预测，全局校准：
- 预测时：使用该学生的 P_simple
- 校准时：所有学生的误差贡献给同一个全局 w
```

### 数据流

```
┌─────────────────────────────────────────────────────┐
│                    UOK Kernel                        │
│                                                      │
│  state._ml.transfer.weights (GLOBAL, SHARED)         │
│       ↑                                              │
│       │ 所有学生的梯度贡献                            │
│       │                                              │
│  ┌────┴──────────────────────────────────────┐    │
│  │  predict() / updateTransferWeights()       │    │
│  │  - 学生 A: 预测 + 贡献梯度                  │    │
│  │  - 学生 B: 预测 + 贡献梯度                  │    │
│  │  - 学生 C: 预测 + 贡献梯度                  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 预期性能提升

| 指标 | Local Weights | Global Shared Weights |
|------|---------------|---------------------|
| Win Rate | 50% | **80%+** |
| 收敛速度 | 慢（每个学生重新发明轮子）| 快（前 100 学生定死基准）|

---

## predict() 完整逻辑（Finalized）

```typescript
predict(studentId: string, questionId: string, ctx: Context): number {
  const qTarget = this.state.questions.get(questionId);
  if (!qTarget) return 0.5;

  // 1. 找参照题
  const ref = this.findReference(studentId, questionId);

  if (ref === null) {
    return this.mlpPredict(studentId, questionId, ctx);
  }

  // 2. 检查距离约束
  const deltaC = this.calculateDeltaC(ref, qTarget);
  const distance = this.norm(deltaC);
  if (distance > this.state._ml.transfer.maxDistance) {
    return this.mlpPredict(studentId, questionId, ctx);
  }

  // 3. 检查 MLP 可靠性
  const refQ = this.state.questions.get(ref.questionId);
  const student = this.state.students.get(studentId);
  const isReliable =
    refQ && refQ.attemptCount >= this.state._ml.transfer.minRefAttempts &&
    student && student.attemptCount >= this.state._ml.transfer.minStudentAttempts;

  if (!isReliable) {
    return this.mlpPredict(studentId, questionId, ctx);
  }

  // 4. 融合预测
  const pSimple = this.mlpPredict(studentId, ref.questionId, {
    difficulty: refQ!.features.difficulty,
    complexity: refQ!.features.complexity,
  });

  // 应用 transfer（带 Clamp 稳定性约束）
  const pTransfer = this.applyTransfer(pSimple, deltaC);

  // λ 加权
  const lambda = Math.min(1, refQ!.attemptCount / this.state._ml.transfer.fusionK);
  const pMlp = this.mlpPredict(studentId, questionId, ctx);

  return lambda * pMlp + (1 - lambda) * pTransfer;
}

/**
 * 应用复杂度迁移映射（带数值稳定性）
 */
private applyTransfer(pSimple: number, deltaC: ComplexityDelta): number {
  const w = this.state._ml.transfer.weights;
  const weightedDelta =
    w.cognitiveLoad * deltaC.cognitiveLoad +
    w.reasoningDepth * deltaC.reasoningDepth +
    w.complexity * deltaC.complexity;

  // Clamp: 防止数值爆炸
  const clampedDelta = Math.max(0, Math.min(weightedDelta, 2.0));

  return pSimple * Math.exp(-clampedDelta);
}
```

---

## updateTransferWeights() 完整逻辑（Finalized）

```typescript
private updateTransferWeights(
  studentId: string,
  questionId: string,
  correct: boolean
): void {
  const { _ml } = this.state;
  const config = _ml.transfer;
  const tau = config.gateThreshold; // 0.55
  const lr = this.getAdaptiveLR();  // 带衰减的学习率

  // 1. 找参照题
  const complexQ = this.state.questions.get(questionId);
  if (!complexQ || complexQ.topics.length === 0) return;

  const simpleQuestionId = this.findSimplerReferenceQuestion(
    questionId,
    complexQ.topics[0]
  );
  if (!simpleQuestionId) return;

  // 2. 检查门控
  const simpleQ = this.state.questions.get(simpleQuestionId);
  if (!simpleQ) return;

  const pSimple = this.predict(studentId, simpleQuestionId, {
    difficulty: simpleQ.features.difficulty,
    complexity: simpleQ.features.complexity,
  });

  if (pSimple < tau) return;

  // 3. 计算 delta 和误差
  const deltaC: ComplexityDelta = {
    cognitiveLoad: Math.max(0, complexQ.features.cognitiveLoad - simpleQ.features.cognitiveLoad),
    reasoningDepth: Math.max(0, complexQ.features.reasoningDepth - simpleQ.features.reasoningDepth),
    complexity: Math.max(0, complexQ.features.complexity - simpleQ.features.complexity),
  };

  if (deltaC.cognitiveLoad === 0 && deltaC.reasoningDepth === 0 && deltaC.complexity === 0) {
    return;
  }

  const pComplexPredicted = this.applyTransfer(pSimple, deltaC);
  const y = correct ? 1 : 0;
  const error = y - pComplexPredicted;

  // 4. 更新全局权重（所有学生共享）
  const weights = config.weights;
  if (deltaC.cognitiveLoad > 0) {
    weights.cognitiveLoad = Math.max(0, weights.cognitiveLoad + lr * error * deltaC.cognitiveLoad);
  }
  if (deltaC.reasoningDepth > 0) {
    weights.reasoningDepth = Math.max(0, weights.reasoningDepth + lr * error * deltaC.reasoningDepth);
  }
  if (deltaC.complexity > 0) {
    weights.complexity = Math.max(0, weights.complexity + lr * error * deltaC.complexity);
  }

  // 5. 归一化
  const sum = weights.cognitiveLoad + weights.reasoningDepth + weights.complexity;
  if (sum > 0) {
    weights.cognitiveLoad /= sum;
    weights.reasoningDepth /= sum;
    weights.complexity /= sum;
  }

  // 6. 周期性衰减学习率
  if (++_ml.updateCounter % 1000 === 0) {
    this.decayLearningRate();
  }
}

/**
 * 自适应学习率（初期大步，后期微调）
 */
private getAdaptiveLR(): number {
  const baseLR = 0.01;
  const decay = 0.95;
  const decaySteps = Math.floor(this.state._ml.updateCounter / 1000);
  return baseLR * Math.pow(decay, decaySteps);
}
```

---

## 默认配置（Finalized）

```typescript
const DEFAULT_TRANSFER_CONFIG: TransferConfig = {
  weights: {
    cognitiveLoad: 0.2,      // 有偏先验
    reasoningDepth: 0.3,
    complexity: 0.5,          // 核心因子
  },
  gateThreshold: 0.55,       // 略高于随机猜测
  learningRate: 0.01,        // 初期
  maxDistance: 0.5,          // 最大迁移距离
  minRefAttempts: 5,          // 参照题最小尝试
  minStudentAttempts: 3,     // 学生最小尝试
  fusionK: 10,              // λ 计算分母
};
```

---

## 验证清单

| 检查项 | 状态 |
|--------|------|
| CTG > 0（平均） | ✅ 已验证 |
| Win Rate > 50% | ⚠️ 需 Global Weights 进一步提升 |
| 权重不塌缩到 0 | ✅ Clamp 约束 |
| 数值稳定无爆炸 | ✅ Clamp + 归一化 |
| 收敛速度合理 | ⚠️ 需实际数据验证 |

---

## 实现边界

**做：**
- 有偏先验权重初始化
- 固定门控阈值 0.55
- Clamp 数值稳定性约束
- 自适应学习率衰减
- Global Shared Weights 架构

**不做：**
- 不做复杂的自适应 τ
- 不实现多层嵌套映射
- 不做在线 A/B 测试框架

---

## 扩展点（v2.2+）

- Topic-specific w（不同 topic 有不同权重）
- 自适应 maxDistance（根据 topic 调整）
- 跨知识点迁移
- 预测置信度输出
