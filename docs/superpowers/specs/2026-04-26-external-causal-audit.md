# 外部因果审计协议 (External Causal Audit Protocol)

**日期**: 2026-04-26
**状态**: 设计草案
**目的**: 从"内部自洽"到"外部真实"的验证桥梁

---

## 问题陈述

v2.8 验证通过的是：

| 类型 | v2.8 验证 | 缺失 |
|------|----------|------|
| 内部一致性 | ✅ | - |
| 数学一致性 | ✅ | - |
| 编程一致性 | ✅ | - |
| **外部因果有效性** | ❌ | 未验证 |
| **模型错误容忍性** | ❌ | 未验证 |
| **跨域泛化** | ❌ | 未验证 |

---

## 核心思想

> **内部自洽 ≠ 外部真实**

一个模型可以在自己定义的世界里完美运行，但这不代表它捕捉了真实因果结构。

**关键区别**：

```
内部自洽：f(f(f(x))) 收敛，且输出合理
外部真实：f(x) 对未见的 x' 仍然正确
```

---

## 审计协议设计

### Audit 1: Leave-One-Domain-Out (LODO)

**目标**: 验证因果结构是否跨域泛化

**方法**:
1. 在 Domain A 训练（如勾股定理）
2. 在 Domain B 测试（如相似三角形）
3. 检查 Z 的因果结构是否一致

**通过条件**:
- 共同节点的因果效应方向一致
- 干预效应大小相关度 > 0.6
- 反事实预测准确率 > 0.65

```typescript
interface LODOResult {
  domainA: string;      // 训练域
  domainB: string;      // 测试域
  sharedNodes: string[]; // 共享节点
  causalDirectionConsistency: number;  // 因果方向一致性
  interventionCorrelation: number;     // 干预效应相关性
  counterfactualAccuracy: number;      // 反事实准确率
  passed: boolean;
}
```

---

### Audit 2: Intervention Replay

**目标**: 验证模拟干预是否与真实干预一致

**方法**:
1. 在模拟环境中执行 do(Z=z)
2. 在真实环境（或更复杂的模拟）中执行相同干预
3. 比较效应

**关键假设**: 我们需要一个"更真实的生成器"作为 ground truth

```typescript
interface InterventionReplayResult {
  intervention: { nodeId: string; value: number };
  simulatedEffect: number;   // v2.8 SCM 预测
  groundTruthEffect: number;  // 更真实模型
  error: number;
  passed: boolean;
}
```

**通过条件**: |simulated - groundTruth| < 0.15

---

### Audit 3: Counterfactual Sanity Check

**目标**: 验证反事实推理的合理性

**方法**:
1. 选择明显的事实（如能力=0.9，答对了）
2. 计算 Y_{ability=0} 的反事实
3. 检查反事实结果是否合理

**合理性检查**:
- 高能力 → 低能力干预：效应应该为负
- 低能力 → 高能力干预：效应应该为正
- 效应大小应该与区分度相关

```typescript
interface CounterfactualSanityResult {
  factual: { ability: number; correct: boolean };
  counterfactual: { ability: number; predictedCorrect: boolean };
  effectSign: number;  // 应该有预期符号
  magnitudeReasonable: boolean;
  passed: boolean;
}
```

---

### Audit 4: Model Misspecification Test

**目标**: 验证模型在错误假设下的行为

**方法**:
1. 故意破坏模型的某个假设（如去掉噪声项 U）
2. 检查系统是否检测到退化

**退化检测**:
- 识别性下降
- 预测方差增大
- 因果效应不稳定

```typescript
interface MisspecificationResult {
  assumptionBroken: string;  // 被破坏的假设
  identifiabilityDrop: number;
  predictionVarianceIncrease: number;
  causalStability: number;
  detected: boolean;
}
```

---

### Audit 5: Cross-Student Intervention

**目标**: 验证因果效应是否跨学生一致

**方法**:
1. 对学生 A 执行干预 do(node := 1.0)
2. 对学生 B 执行相同干预
3. 检查效应方向是否一致（效应大小可以不同）

```typescript
interface CrossStudentResult {
  studentA: string;
  studentB: string;
  intervention: { nodeId: string; value: number };
  effectA: number;
  effectB: number;
  directionConsistent: boolean;
  passed: boolean;
}
```

---

## 实施计划

### Phase 1: 基础审计（立即）

```typescript
/**
 * 外部因果审计 - Phase 1
 */
class ExternalCausalAudit {
  /**
   * Audit 1: Leave-One-Domain-Out
   */
  async auditLODO(
    domainA: CognitiveNode[],
    domainB: CognitiveNode[]
  ): Promise<LODOResult> {
    // 1. 在 Domain A 训练模型
    const modelA = new UnifiedSCM(domainA);

    // 2. 找到共享节点
    const sharedNodes = domainA
      .filter(na => domainB.some(nb => nb.id === na.id))
      .map(n => n.id);

    // 3. 比较因果结构
    const causalDirectionConsistency = this.compareCausalStructure(
      domainA,
      domainB,
      sharedNodes
    );

    // 4. 比较干预效应
    const interventionCorrelation = this.compareInterventions(
      modelA,
      domainB,
      sharedNodes
    );

    return {
      domainA: domainA[0].knowledgeUnit,
      domainB: domainB[0].knowledgeUnit,
      sharedNodes,
      causalDirectionConsistency,
      interventionCorrelation,
      counterfactualAccuracy: 0, // TODO
      passed:
        causalDirectionConsistency > 0.8 &&
        interventionCorrelation > 0.6,
    };
  }

  /**
   * Audit 3: Counterfactual Sanity Check
   */
  auditCounterfactualSanity(
    scm: UnifiedSCM,
    testCases: Array<{
      ability: number;
      effort: number;
      attention: number;
      question: SubQuestion;
    }>
  ): CounterfactualSanityResult[] {
    const results: CounterfactualSanityResult[] = [];

    for (const testCase of testCases) {
      const Z: LatentState = {
        trueAbilities: new Map([[testCase.question.nodeContributions[0].nodeId, testCase.ability]]),
        effort: testCase.effort,
        attention: testCase.attention,
        timestamp: Date.now(),
      };

      const { X, Y } = scm.generate(Z, testCase.question, scm.sampleNoise());

      // 反事实：能力设为 0
      const cf = new PearlCounterfactual().computeCounterfactual(
        { Z, X, Y, question: testCase.question },
        { param: 'ability', nodeId: testCase.question.nodeContributions[0].nodeId, value: 0 },
        scm
      );

      results.push({
        factual: { ability: testCase.ability, correct: Y },
        counterfactual: { ability: 0, predictedCorrect: cf.counterfactual > 0.5 },
        effectSign: cf.effect,
        magnitudeReasonable: Math.abs(cf.effect) < 1,
        passed: cf.effect < 0, // 高能力 → 低能力，效应应该为负
      });
    }

    return results;
  }

  private compareCausalStructure(
    domainA: CognitiveNode[],
    domainB: CognitiveNode[],
    sharedNodes: string[]
  ): number {
    // 比较依赖边方向是否一致
    let consistent = 0;
    let total = 0;

    for (const nodeId of sharedNodes) {
      const nodeA = domainA.find(n => n.id === nodeId);
      const nodeB = domainB.find(n => n.id === nodeId);

      if (nodeA && nodeB) {
        // 检查前驱节点
        const predsA = new Set(nodeA.dependencies.map(d => d.prerequisiteId));
        const predsB = new Set(nodeB.dependencies.map(d => d.prerequisiteId));

        for (const sharedNode of sharedNodes) {
          if (predsA.has(sharedNode) === predsB.has(sharedNode)) {
            consistent++;
          }
          total++;
        }
      }
    }

    return total > 0 ? consistent / total : 0;
  }

  private compareInterventions(
    modelA: UnifiedSCM,
    domainB: CognitiveNode[],
    sharedNodes: string[]
  ): number {
    // 简化：返回随机相关性
    // 实际应该执行干预并比较
    return 0.7;
  }
}
```

---

## 验证标准

### 通过阈值

| Audit | 指标 | 阈值 |
|-------|------|------|
| LODO | 因果方向一致性 | > 0.8 |
| LODO | 干预效应相关性 | > 0.6 |
| Counterfactual | 效应符号正确率 | > 0.9 |
| Misspecification | 检测率 | > 0.7 |
| Cross-Student | 方向一致性 | > 0.8 |

### 总体评估

```
External Causal Validity = weighted_average(
  LODO.passed * 0.3,
  Counterfactual.passed * 0.3,
  Misspecification.detected * 0.2,
  CrossStudent.passed * 0.2
)
```

**通过条件**: External Causal Validity > 0.7

---

## 下一步

1. 实现 Audit 1-3 的基础版本
2. 收集第二个知识域（如相似三角形）
3. 运行完整审计
4. 根据结果调整模型

---

**文档版本**: v0.1
**状态**: 设计草案，待实施
