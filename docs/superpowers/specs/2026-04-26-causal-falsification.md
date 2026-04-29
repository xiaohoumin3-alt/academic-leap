# 因果可证伪系统 (Causal Falsification Engine)

**日期**: 2026-04-26
**状态**: 设计草案
**目的**: 从"内部一致"到"可证伪科学模型"的验证桥梁

---

## 核心问题

> **"内部自洽 + 跨域一致" ≠ "真实因果"**

当前 v2.8 + 外部审计证明的是：
- ✅ representation invariance
- ✅ structural stability
- ✅ intervention consistency

但没有证明：
- ❌ 机制对应真实世界
- ❌ 因果结构可被证伪
- ❌ 模型能抵抗机制破坏

---

## 可证伪性原则 (Popper's Falsifiability)

> **一个科学理论必须能被观察证伪**

对于因果模型，这意味着：

```
如果模型声称 X → Y 是因果关系，
那么当破坏 X → Y 的机制时，
模型必须检测到这种破坏。
```

---

## Falsification Engine 设计

### Test 1: Mechanism Break Test

**目标**: 破坏生成机制，验证模型能否检测

**方法**:
1. 正常模型：Y = f(X, Z) + noise
2. 破坏模型：Y = g(X', Z') + noise'（完全不同的机制）
3. 检查模型是否检测到"结构断裂"

**预期结果**:
- 因果效应方向改变
- 识别性急剧下降
- 干预效应不稳定

```typescript
interface MechanismBreakResult {
  normalMechanism: {
    causalDirection: string;
    interventionEffect: number;
    identifiability: number;
  };
  brokenMechanism: {
    causalDirection: string;
    interventionEffect: number;
    identifiability: number;
  };
  detected: boolean;
  detectionStrength: number;
}
```

---

### Test 2: Hidden Confounder Shift

**目标**: 改变隐藏混淆变量，验证模型是否敏感

**方法**:
1. 原始：Z → X, Z → Y（Z 是混淆变量）
2. 改变：Z' → X, Z' → Y（Z' 有不同分布）
3. 检查 do(X) 的估计是否变化

**关键**: 如果模型声称正确因果，应该能检测到混淆变化

```typescript
interface ConfounderShiftResult {
  originalConfounder: {
    backdoorAdjustment: number;
    causalEffect: number;
  };
  shiftedConfounder: {
    backdoorAdjustment: number;
    causalEffect: number;
  };
  shiftDetected: boolean;
  adjustmentCorrect: boolean;
}
```

---

### Test 3: Intervention Mismatch Test

**目标**: 在错误机制下执行干预，验证模型是否拒绝

**方法**:
1. 用机制 M1 生成数据
2. 用机制 M2 的干预模型分析
3. 检查模型是否检测到不匹配

**预期**: 干预效应应该与真实效应显著不同

```typescript
interface InterventionMismatchResult {
  trueMechanism: string;
  assumedMechanism: string;
  trueEffect: number;
  estimatedEffect: number;
  mismatchDetected: boolean;
  error: number;
}
```

---

### Test 4: Structural Break Detection

**目标**: 在数据中注入结构断裂，验证检测能力

**方法**:
1. 前半段：机制 M1
2. 后半段：机制 M2
3. 检查模型能否检测到断裂点

**预期**: 因果效应在断裂点前后应该显著不同

```typescript
interface StructuralBreakResult {
  breakPoint: number;
  beforeEffect: number;
  afterEffect: number;
  effectDifference: number;
  breakDetected: boolean;
  detectedLocation: number;
}
```

---

### Test 5: Adversarial Mechanism Perturbation

**目标**: 对抗性攻击因果结构

**方法**:
1. 找到模型的"脆弱假设"
2. 系统性地破坏这个假设
3. 验证模型是否崩溃

**脆弱假设示例**:
- 噪声独立性
- 线性关系
- 马尔可夫性
- 稳态分布

```typescript
interface AdversarialPerturbationResult {
  assumptionBroken: string;
  perturbationType: 'noise_correlation' | 'nonlinear' | 'non_markov' | 'distribution_shift';
  modelPerformance: {
    before: number;
    after: number;
    degradation: number;
  };
  vulnerabilityDetected: boolean;
}
```

---

## Falsification Criteria

### 模型通过可证伪测试的条件：

| Test | 通过条件 | 说明 |
|------|---------|------|
| Mechanism Break | 检测率 > 80% | 能检测机制破坏 |
| Confounder Shift | 调整正确率 > 70% | 混淆变化时正确调整 |
| Intervention Mismatch | 误差 > 30% 时检测 | 错误干预时拒绝 |
| Structural Break | 定位误差 < 10% | 准确找到断裂点 |
| Adversarial | 脆弱性被识别 | 能识别自身弱点 |

### 总体可证伪性评分：

```
Falsifiability Score = weighted_average(
  MechanismBreak.detected * 0.3,
  ConfounderShift.shiftDetected * 0.25,
  InterventionMismatch.mismatchDetected * 0.2,
  StructuralBreak.breakDetected * 0.15,
  Adversarial.vulnerabilityDetected * 0.1
)
```

**通过阈值**: Falsifiability Score > 0.7

---

## 与外部审计的区别

| 维度 | 外部审计 | 可证伪测试 |
|------|---------|-----------|
| 目标 | 验证跨域稳定性 | 验证机制可破坏性 |
| 方法 | 正向测试 | 负向测试 |
| 假设 | 模型正确 | 模型可错 |
| 结论 | "模型稳定" | "模型科学" |

---

## 关键洞察

### 为什么可证伪性更重要？

> **一个不能被证伪的理论不是科学理论**

如果模型：
- 在任何破坏下都"通过"
- 无法区分正确机制和错误机制
- 对假设破坏不敏感

那么它：
- 可能只是"拟合良好"
- 不是真正的因果模型
- 缺乏科学有效性

---

## 实施计划

### Phase 1: 基础可证伪测试

```typescript
class CausalFalsificationEngine {
  /**
   * 运行完整可证伪测试套件
   */
  runFalsificationSuite(): FalsificationResult {
    return {
      mechanismBreak: this.testMechanismBreak(),
      confounderShift: this.testConfounderShift(),
      interventionMismatch: this.testInterventionMismatch(),
      structuralBreak: this.testStructuralBreak(),
      adversarial: this.testAdversarialPerturbation(),
      overallFalsifiability: 0, // computed
      passed: false, // determined
    };
  }
}
```

### Phase 2: 机制破坏生成器

```typescript
class MechanismBreaker {
  /**
   * 生成破坏机制的版本
   */
  breakMechanism(original: SCM): SCM {
    return {
      ...original,
      // 破坏结构方程
      equations: original.equations.map(e => ({
        ...e,
        function: this.corruptFunction(e.function),
      })),
    };
  }

  private corruptFunction(fn: Function): Function {
    // 完全不同的机制
    return (x) => Math.sin(x * 3.14159); // 示例
  }
}
```

---

## 验证标准

### 科学有效性判定

```
Scientific Validity = (
  Falsifiability Score > 0.7 &&
  Mechanism Break Detection > 0.8 &&
  能明确说明"什么情况下模型会失败"
)
```

### 关键问题

模型必须能回答：

> **"在什么条件下，你的因果结论不再成立？"**

如果无法回答，模型缺乏科学有效性。

---

## 下一步

1. 实现 MechanismBreaker
2. 实现 FalsificationEngine
3. 运行完整测试套件
4. 根据结果调整模型

---

**文档版本**: v0.1
**状态**: 设计草案，待实施

---

## 附录：可证伪性检查清单

一个因果模型必须明确：

- [ ] 机制何时失效
- [ ] 哪些假设被破坏时模型崩溃
- [ ] 什么情况下干预无效
- [ ] 如何检测模型错误
- [ ] 模型的适用边界

如果无法明确这些，模型缺乏可证伪性。
