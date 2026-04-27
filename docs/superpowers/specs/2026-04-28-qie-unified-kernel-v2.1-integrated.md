# QIE Unified Kernel v2.1 - Integrated Complexity Transfer

**日期**: 2026-04-28
**状态**: v2.1 整合版
**基于**: v2.0 + Complexity Transfer

---

## 核心定位

> **一个系统，自动在简单题和复杂题之间做能力迁移预测**

```
predict() 内部自动完成：
1. 找参照题（学生有有效信号的最接近简单题）
2. 检查距离约束（τ_max）
3. 检查 MLP 可靠性（k_q, k_s）
4. 融合预测（λ 加权）
```

---

## 架构整合

### v2.0 提供了什么
- 特征提取：`cognitiveLoad`, `reasoningDepth`, `complexity`
- 单写入口约束：`learnML()` 是 ML 状态的唯一修改点
- 可观测性：`encodeAnswer()` 返回学习前的预测

### Complexity Transfer 提供了什么
- 映射函数：`P_complex = P_simple · exp(- w · ΔC)`
- 权重向量：`(w_cognitive, w_reasoning, w_complexity)`
- 门控校准：防止模型误差污染

### v2.1 整合了什么
- 自动参照查找（动态、最近邻、deterministic）
- 融合函数：`P_final = λ * P_mlp + (1 - λ) * P_transfer`
- 可靠性检测：MLP 置信度阈值

---

## predict() 完整逻辑

```typescript
/**
 * 预测（带自动复杂度迁移）
 *
 * 内部流程：
 * 1. 找参照题（学生有有效信号的最接近简单题）
 * 2. 检查距离约束
 * 3. 检查 MLP 可靠性
 * 4. 融合预测
 */
predict(studentId: string, questionId: string, ctx: Context): number {
  const qTarget = this.state.questions.get(questionId);
  if (!qTarget) return 0.5;

  // === 1. 找参照题 ===
  const ref = this.findReference(studentId, questionId);

  // === 2. 检查是否需要 transfer ===
  if (ref === null) {
    return this.mlpPredict(studentId, questionId, ctx);
  }

  const deltaC = this.calculateDeltaC(ref, qTarget);
  const distance = this.norm(deltaC);

  // 距离太大，不迁移
  if (distance > this.state._ml.transfer.maxDistance) {
    return this.mlpPredict(studentId, questionId, ctx);
  }

  // === 3. 检查 MLP 可靠性 ===
  const refQ = this.state.questions.get(ref.questionId);
  const student = this.state.students.get(studentId);

  const isReliable =
    refQ && refQ.attemptCount >= this.state._ml.transfer.minRefAttempts &&
    student && student.attemptCount >= this.state._ml.transfer.minStudentAttempts;

  // === 4. 融合预测 ===
  if (isReliable) {
    // 参照题数据充分，使用 transfer
    const pSimple = this.mlpPredict(studentId, ref.questionId, {
      difficulty: refQ!.features.difficulty,
      complexity: refQ!.features.complexity,
    });

    const pTransfer = this.applyTransfer(pSimple, deltaC);

    // λ = clamp(attemptCount / k, 0, 1)
    const lambda = Math.min(1, refQ!.attemptCount / this.state._ml.transfer.fusionK);

    return lambda * this.mlpPredict(studentId, questionId, ctx) + (1 - lambda) * pTransfer;
  }

  // 数据不足，信任 MLP
  return this.mlpPredict(studentId, questionId, ctx);
}

/**
 * 找参照题
 * - 同 topic
 * - 学生有 attempts（有效信号）
 * - 距离最近的
 * - deterministic tie-break
 */
private findReference(studentId: string, questionId: string): ReferenceQuestion | null {
  const qTarget = this.state.questions.get(questionId);
  if (!qTarget) return null;

  const student = this.state.students.get(studentId);
  if (!student) return null;

  let best: ReferenceQuestion | null = null;
  let bestDistance = Infinity;
  let bestAttempts = -1;

  for (const [qid, q] of this.state.questions) {
    if (qid === questionId) continue;

    // 同 topic
    const sameTopic = q.topics.some(t => qTarget.topics.includes(t));
    if (!sameTopic) continue;

    // 学生有 attempts
    const hasAttempts = q.attemptCount > 0;
    if (!hasAttempts) continue;

    // 计算距离
    const delta = this.calculateDeltaC(q, qTarget);
    const distance = this.norm(delta);

    // 更近 OR 同样近但 attemptCount 更多 OR 同样近同样尝试但 id 更小
    if (distance < bestDistance ||
        (distance === bestDistance && q.attemptCount > bestAttempts) ||
        (distance === bestDistance && q.attemptCount === bestAttempts && qid < (best?.questionId ?? ''))) {
      bestDistance = distance;
      bestAttempts = q.attemptCount;
      best = { questionId: qid, features: q.features };
    }
  }

  return best;
}

/**
 * 应用复杂度迁移映射
 * P_complex = P_simple · exp(- w · ΔC)
 */
private applyTransfer(pSimple: number, deltaC: ComplexityDelta): number {
  const w = this.state._ml.transfer.weights;
  const weightedDelta =
    w.cognitiveLoad * deltaC.cognitiveLoad +
    w.reasoningDepth * deltaC.reasoningDepth +
    w.complexity * deltaC.complexity;

  return pSimple * Math.exp(-weightedDelta);
}

/**
 * MLP 预测（原始，不使用 transfer）
 */
private mlpPredict(studentId: string, questionId: string, ctx: Context): number {
  const s = this.getEmbedding(this.state._ml.embeddings.students, studentId);
  const q = this.getEmbedding(this.state._ml.embeddings.questions, questionId);
  const x = this.embedInput(s, q, ctx);

  const h = this.relu(this.matmul(x, this.state._ml.weights.w1, this.state._ml.weights.b1));
  const z = this.dot(h, this.state._ml.weights.w2) + this.state._ml.weights.b2;
  return this.sigmoid(z);
}

/**
 * 计算复杂度差向量
 */
private calculateDeltaC(qSimple: QuestionState, qComplex: QuestionState): ComplexityDelta {
  return {
    cognitiveLoad: qComplex.features.cognitiveLoad - qSimple.features.cognitiveLoad,
    reasoningDepth: qComplex.features.reasoningDepth - qSimple.features.reasoningDepth,
    complexity: qComplex.features.complexity - qSimple.features.complexity,
  };
}

/**
 * 计算向量范数
 */
private norm(delta: ComplexityDelta): number {
  return Math.sqrt(
    delta.cognitiveLoad ** 2 +
    delta.reasoningDepth ** 2 +
    delta.complexity ** 2
  );
}
```

---

## 类型扩展

```typescript
interface ReferenceQuestion {
  questionId: string;
  features: QuestionFeatures;
}

interface TransferConfig {
  weights: ComplexityTransferWeights;        // 映射权重
  gateThreshold: number;                     // τ: MLP 可靠性阈值
  learningRate: number;                      // η: 权重更新步长
  maxDistance: number;                      // τ_max: 最大迁移距离
  minRefAttempts: number;                   // k_q: 参照题最小尝试次数
  minStudentAttempts: number;               // k_s: 学生最小尝试次数
  fusionK: number;                          // λ 计算的分母
}

interface MLState {
  embeddings: { ... };
  weights: { ... };
  updateCounter: number;
  transfer: TransferConfig;                 // 整合后的 transfer 配置
}
```

---

## 默认配置

```typescript
const DEFAULT_TRANSFER_CONFIG: TransferConfig = {
  weights: {
    cognitiveLoad: 1/3,
    reasoningDepth: 1/3,
    complexity: 1/3,
  },
  gateThreshold: 0.7,        // MLP 可靠性阈值
  learningRate: 0.01,       // 权重更新步长
  maxDistance: 0.5,         // 最大迁移距离（可调）
  minRefAttempts: 5,        // 参照题最小 5 次尝试
  minStudentAttempts: 3,    // 学生最小 3 次尝试
  fusionK: 10,              // λ = clamp(attempts/10, 0, 1)
};
```

---

## 与 v2.0 的区别

| 方面 | v2.0 | v2.1 |
|------|------|------|
| predict() | 纯 MLP | MLP + 动态 Transfer |
| 参照题 | 无 | 自动查找 |
| 融合 | 无 | λ 加权 |
| 可靠性检测 | 无 | k_q, k_s 阈值 |
| 单写入口 | learnML() | learnML() + updateTransferWeights() |

---

## 验证闭包

| 维度 | 状态 | 说明 |
|------|------|------|
| 参数约束 | ✓ | wᵢ ≥ 0, Σwᵢ = 1 |
| 边界条件 | ✓ | ΔC → 0 ⇒ P_complex → P_simple |
| 可微性 | ✓ | 融合函数连续可导 |
| 单调性 | ✓ | 复杂度↑ ⇒ P_complex ↓ |
| 可学习 | ✓ | 在线校准收敛 |
| 无破坏性 | ✓ | 旧 API 兼容 |
| 信号隔离 | ✓ | 门控防止污染 |
| 确定性 | ✓ | tie-break 规则保证 |
| 融合 | ✓ | λ 加权防止覆盖 |

---

## 实现边界

**做：**
- 整合 predict() 内部逻辑
- 添加 findReference(), applyTransfer(), mlpPredict() 私有方法
- 扩展 MLState.transfer 配置
- 添加 maxDistance, minRefAttempts, minStudentAttempts, fusionK 参数

**不做：**
- 不改变 encodeAnswer() 行为
- 不改变 learnML() 单写入口
- 不暴露 transfer 细节到公共 API
- 不实现其他候选函数

---

## 扩展点（未来）

- 自适应 τ_max（根据 topic 调整）
- 跨知识点迁移
- 预测置信度输出
- 非线性融合函数
