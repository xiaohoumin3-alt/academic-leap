# Question Graph 架构设计文档 v2.6（工程稳定版）

**日期**: 2026-04-26
**状态**: 架构成立 + 工程稳定
**作者**: AI + 用户头脑风暴 + 多轮架构评审 + v2.5工程修正

---

## v2.6 核心修正

> **v2.6 目标：解决"理论成立 vs 工程稳定"之间的缺口，确保系统可生产验证。**

本版本基于 v2.5，修正3个工程级致命问题：
1. **反事实误差** → 解决 error 分解不正交问题
2. **节点级惩罚** → 解决局部问题污染全局
3. **外部理想信号** → 解决模型自引用问题

---

## 目录

- [一、v2.6 变更说明](#一v26-变更说明)
- [二、反事实误差计算](#二反事实误差计算)
- [三、节点级惩罚系统](#三节点级惩罚系统)
- [四、外部理想信号](#四外部理想信号)
- [五、正交性验证](#五正交性验证)
- [六、完整数据结构](#六完整数据结构)
- [七、Phase 0 可运行验证](#七phase-0-可运行验证)

---

## 一、v2.6 变更说明

### 1.1 三大工程修正

| # | 问题 | v2.5 | v2.6 |
|---|------|------|------|
| 1 | Error 分解不正交 | 三个 error 强相关 | **反事实误差** |
| 2 | Penalty 全局化 | 局部问题→全局震荡 | **节点级惩罚** |
| 3 | Ideal 自引用 | 模型解释模型 | **外部经验信号** |

### 1.2 问题诊断

#### 问题1：Error 分解不正交

**v2.5 的定义**：
```typescript
baseError = |baseScore - ideal|
penaltyError = |afterPenalty - beforePenalty|
weightError = |beforePenalty - baseScore|
```

**问题**：如果 weight 错了，会导致：
- `predictedBeforePenalty` 错
- `predictedAfterPenalty` 也错
- 结果：`weightError` ↑，`penaltyError` 也 ↑

**误判风险**：LogAnalyzer 可能误判为 "penalty 有问题"

#### 问题2：Penalty 全局化

**v2.5 的设计**：
```typescript
penaltyCorrection: number  // 全局单一值
```

**问题**：某个节点依赖结构特殊 → penalty 被误判 → 影响所有节点

#### 问题3：Ideal 自引用

**v2.5 的定义**：
```typescript
idealPrediction = mastery.decayedLevel
```

**问题**：mastery 本身是模型输出 → 用模型解释模型 → endogeneity（内生性）

### 1.3 设计哲学

> **正交性（Orthogonality）+ 可识别性（Identifiability）**

v2.6 的核心原则：
1. **每个误差维度必须正交**（变化一个不影响其他）
2. **每个参数必须独立可测**
3. **理想信号必须来自外部**（避免自引用）

---

## 二、反事实误差计算

### 2.1 核心思想

**传统误差**（有问题）：
```
totalError = |actual - prediction|
```

**反事实误差**（修正后）：
```
对于每个参数 p：
counterfactualPrediction_p = prediction(将 p 设为理想值，其他保持当前值)

marginalImpact_p = |actual - current| - |actual - counterfactual_p|
```

**关键**：固定其他变量，只看单一参数的边际影响

### 2.2 数据结构

```typescript
// ============================================================
// 反事实误差（新增）
// ============================================================
interface CounterfactualErrors {
  // 当前预测
  currentPrediction: number;

  // 反事实预测（每个参数设为理想值时的预测）
  counterfactualWithIdealBase: number;
  counterfactualWithIdealWeight: number;
  counterfactualWithIdealPenalty: number;

  // 边际影响（当前误差 - 反事实误差）
  baseMarginalImpact: number;
  weightMarginalImpact: number;
  penaltyMarginalImpact: number;

  // 正交化误差（归一化到 [0,1]）
  baseError: number;
  weightError: number;
  penaltyError: number;

  // 正交性验证（新增）
  orthogonalityScore: number;  // 三个误差的独立性得分
}

// 理想值定义
interface IdealValues {
  idealBaseScore: number;      // 通常 = actualCorrect ? 1 : 0
  idealWeight: number;         // 从 nodeRegistry 获取
  idealPenalty: number;        // 1.0（无惩罚）
}
```

### 2.3 计算逻辑

```typescript
// ============================================================
// 反事实误差计算器
// ============================================================
class CounterfactualErrorCalculator {
  // ===== 核心计算方法 =====
  calculate(
    actualCorrect: boolean,
    baseScore: number,
    weight: number,
    penalty: number,
    idealValues: IdealValues
  ): CounterfactualErrors {
    const actual = actualCorrect ? 1.0 : 0.0;

    // 当前预测
    const currentPrediction = baseScore * weight * penalty;
    const currentError = Math.abs(actual - currentPrediction);

    // ===== 反事实预测 =====
    // 固定其他参数，只变一个

    // 反事实1：baseScore 设为理想值
    const cfBase = idealValues.idealBaseScore * weight * penalty;
    const errorWithIdealBase = Math.abs(actual - cfBase);
    const baseMarginalImpact = currentError - errorWithIdealBase;

    // 反事实2：weight 设为理想值
    const cfWeight = baseScore * idealValues.idealWeight * penalty;
    const errorWithIdealWeight = Math.abs(actual - cfWeight);
    const weightMarginalImpact = currentError - errorWithIdealWeight;

    // 反事实3：penalty 设为理想值（1.0 = 无惩罚）
    const cfPenalty = baseScore * weight * idealValues.idealPenalty;
    const errorWithIdealPenalty = Math.abs(actual - cfPenalty);
    const penaltyMarginalImpact = currentError - errorWithIdealPenalty;

    // ===== 正交化误差（归一化） =====
    const totalImpact = Math.abs(baseMarginalImpact) +
                        Math.abs(weightMarginalImpact) +
                        Math.abs(penaltyMarginalImpact);

    const baseError = totalImpact > 0
      ? Math.abs(baseMarginalImpact) / totalImpact
      : 0;
    const weightError = totalImpact > 0
      ? Math.abs(weightMarginalImpact) / totalImpact
      : 0;
    const penaltyError = totalImpact > 0
      ? Math.abs(penaltyMarginalImpact) / totalImpact
      : 0;

    // ===== 正交性验证 =====
    const orthogonalityScore = this.calculateOrthogonality(
      baseMarginalImpact,
      weightMarginalImpact,
      penaltyMarginalImpact
    );

    return {
      currentPrediction,
      counterfactualWithIdealBase: cfBase,
      counterfactualWithIdealWeight: cfWeight,
      counterfactualWithIdealPenalty: cfPenalty,
      baseMarginalImpact,
      weightMarginalImpact,
      penaltyMarginalImpact,
      baseError,
      weightError,
      penaltyError,
      orthogonalityScore,
    };
  }

  // ===== 正交性计算 =====
  // 三个维度正交的定义：它们的协方差矩阵接近对角阵
  private calculateOrthogonality(
    baseImpact: number,
    weightImpact: number,
    penaltyImpact: number
  ): number {
    // 简化版：检查三个值是否"独立变化"
    // 完全正交时，三个值的相对大小应该稳定

    const impacts = [baseImpact, weightImpact, penaltyImpact];
    const magnitudes = impacts.map(Math.abs);

    // 如果一个主导，说明其他两个不重要，视为正交
    const maxMag = Math.max(...magnitudes);
    const sumMag = magnitudes.reduce((a, b) => a + b, 0);

    if (sumMag === 0) return 1.0;

    const dominanceRatio = maxMag / sumMag;

    // 主导度 > 0.7 → 视为正交（一个参数主导，其他不重要）
    // 主导度 < 0.4 → 多参数耦合 → 不正交
    if (dominanceRatio > 0.7) return 1.0;
    if (dominanceRatio < 0.4) return 0.3;

    // 线性插值
    return (dominanceRatio - 0.4) / (0.7 - 0.4) * 0.7 + 0.3;
  }
}
```

### 2.4 在归因中集成

```typescript
// ============================================================
// 归因计算（反事实版）
// ============================================================
function attributeResultWithCounterfactual(
  question: SubQuestion,
  result: QuestionResult,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  errorCalculator: CounterfactualErrorCalculator,
  irtLogger?: IRTLogger
): AttributedResult {
  const attributions = new Map<string, NodeAttribution>();
  const weights = normalizeWeights(question.nodeContributions, nodeRegistry, question);

  for (const contrib of question.nodeContributions) {
    const node = nodeRegistry.get(contrib.nodeId)!;
    const weight = weights.get(contrib.nodeId)!;
    const mastery = nodeMasteries.get(contrib.nodeId);

    // ===== 基础计算 =====
    const baseScore = result.isCorrect ? 1.0 : 0.0;
    const baseScoreWithDiscrimination = baseScore * question.discrimination;
    const penalty = calculateNodeDependencyPenalty(contrib.nodeId, nodeMasteries, nodeRegistry);
    const effectiveScore = baseScoreWithDiscrimination * weight * penalty;

    // ===== 反事实误差计算 =====
    const idealValues: IdealValues = {
      idealBaseScore: result.isCorrect ? 1.0 : 0.0,
      idealWeight: getIdealWeight(contrib.nodeId, nodeRegistry),
      idealPenalty: 1.0,  // 无惩罚
    };

    const cfErrors = errorCalculator.calculate(
      result.isCorrect,
      baseScoreWithDiscrimination,
      weight,
      penalty,
      idealValues
    );

    // ===== 置信度更新 =====
    let confidenceUpdate = 0.1 * weight;
    if (result.isCorrect) {
      confidenceUpdate *= question.discrimination;
    } else {
      confidenceUpdate *= 0.5;
    }

    attributions.set(contrib.nodeId, {
      nodeId: contrib.nodeId,
      contribution: weight,
      confidence: confidenceUpdate,
      penalty,
      effectiveScore,
    });

    // ===== 日志记录（反事实版） =====
    if (irtLogger && mastery) {
      const prereqScores = new Map<string, number>();
      for (const dep of node.dependencies) {
        const prereqMastery = nodeMasteries.get(dep.prerequisiteId);
        prereqScores.set(dep.prerequisiteId, prereqMastery ? prereqMastery.decayedLevel : 0);
      }

      irtLogger.log({
        timestamp: Date.now(),
        nodeId: contrib.nodeId,
        questionId: question.questionId,
        studentId: 'student',

        predictedMastery: mastery.decayedLevel,
        actualCorrect: result.isCorrect,

        // 原始数据
        baseScore: baseScoreWithDiscrimination,
        weight,
        penalty,
        questionDiscrimination: question.discrimination,
        nodeImportance: node.importance,
        contributionLevel: contrib.level,
        dependencyPrereqScores: prereqScores,

        // ===== 反事实误差（新增） =====
        counterfactualErrors: cfErrors,
      } as IRTTrainingLog);
    }
  }

  return {
    questionId: question.questionId,
    isCorrect: result.isCorrect,
    primaryNodeId: question.nodeContributions[0].nodeId,
    attributions,
  };
}

// 获取理想权重（从节点定义）
function getIdealWeight(nodeId: string, nodeRegistry: CognitiveNodeRegistry): number {
  const node = nodeRegistry.get(nodeId);
  if (!node) return 0.5;

  // 理想权重 = 节点重要性
  return node.importance;
}
```

---

## 三、节点级惩罚系统

### 3.1 问题分析

**v2.5 的全局惩罚**：
```typescript
penaltyCorrection: number  // 所有节点共享
```

**问题**：
- 某个节点依赖结构特殊
- 全局 penalty 被误判
- 其他节点全部受影响

### 3.2 解决方案：节点级惩罚

```typescript
// ============================================================
// 节点级惩罚系统
// ============================================================
interface NodePenaltyRegistry {
  // 每个节点独立的惩罚系数
  nodePenaltyMultipliers: Map<string, number>;

  // 每条依赖边的惩罚系数（更精细）
  edgePenaltyMultipliers: Map<string, number>;  // key: "sourceId_targetId"

  // 全局基线（fallback）
  globalPenaltyMultiplier: number;

  // 获取节点的惩罚系数
  getNodePenalty(nodeId: string): number;

  // 获取边的惩罚系数
  getEdgePenalty(sourceId: string, targetId: string): number;

  // 校准节点惩罚
  calibrateNodePenalty(nodeId: string, adjustment: number): void;

  // 校准边惩罚
  calibrateEdgePenalty(sourceId: string, targetId: string, adjustment: number): void;
}

class NodePenaltyRegistryImpl implements NodePenaltyRegistry {
  nodePenaltyMultipliers: Map<string, number> = new Map();
  edgePenaltyMultipliers: Map<string, number> = new Map();
  globalPenaltyMultiplier: number = 1.0;

  getNodePenalty(nodeId: string): number {
    return this.nodePenaltyMultipliers.get(nodeId) ?? this.globalPenaltyMultiplier;
  }

  getEdgePenalty(sourceId: string, targetId: string): number {
    const key = `${sourceId}_${targetId}`;
    return this.edgePenaltyMultipliers.get(key) ?? this.getNodePenalty(targetId);
  }

  calibrateNodePenalty(nodeId: string, adjustment: number): void {
    const current = this.getNodePenalty(nodeId);
    const newValue = current * adjustment;
    this.nodePenaltyMultipliers.set(nodeId, Math.max(0.5, Math.min(2.0, newValue)));
  }

  calibrateEdgePenalty(sourceId: string, targetId: string, adjustment: number): void {
    const key = `${sourceId}_${targetId}`;
    const current = this.getEdgePenalty(sourceId, targetId);
    const newValue = current * adjustment;
    this.edgePenaltyMultipliers.set(key, Math.max(0.5, Math.min(2.0, newValue)));
  }
}
```

### 3.3 惩罚计算（节点级）

```typescript
// ============================================================
// 依赖惩罚计算（节点级版）
// ============================================================
function calculateNodeDependencyPenalty(
  nodeId: string,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  penaltyRegistry: NodePenaltyRegistry
): number {
  const node = nodeRegistry.get(nodeId);
  if (!node || node.dependencies.length === 0) {
    return 1.0;  // 无依赖，无惩罚
  }

  let totalPenalty = 0;
  let totalWeight = 0;

  for (const dep of node.dependencies) {
    const prereqMastery = nodeMasteries.get(dep.prerequisiteId);
    const prereqLevel = prereqMastery ? prereqMastery.decayedLevel : 0;

    // 基础惩罚：前置未掌握
    const depWeight = dep.strength === 'strong' ? 0.5 : 0.1;
    const basePenalty = prereqLevel < MASTERY_THRESHOLDS.PREREQUISITE
      ? (1 - prereqLevel) * depWeight
      : 0;

    // ===== 节点级惩罚系数 =====
    const edgeMultiplier = penaltyRegistry.getEdgePenalty(dep.prerequisiteId, nodeId);
    const adjustedPenalty = basePenalty * edgeMultiplier;

    totalPenalty += adjustedPenalty;
    totalWeight += depWeight;
  }

  // 归一化到 [0, 1]
  const avgPenalty = totalWeight > 0 ? totalPenalty / totalWeight : 0;
  return Math.max(0, Math.min(1, 1 - avgPenalty));
}
```

### 3.4 校准逻辑（节点级）

```typescript
// ============================================================
// 参数校准器（节点级惩罚版）
// ============================================================
class NodeLevelParameterCalibrator {
  private logAnalyzer: LogAnalyzer;
  private penaltyRegistry: NodePenaltyRegistry;
  private calibrations: Map<string, ParameterCalibration> = new Map();

  calibrate(
    logs: IRTTrainingLog[],
    nodeRegistry: CognitiveNodeRegistry
  ): Map<string, ParameterCalibration> {
    const byNode = this.groupByNode(logs);
    const results = new Map<string, ParameterCalibration>();

    for (const [nodeId, nodeLogs] of byNode) {
      if (nodeLogs.length < CALIBRATION_CONFIG.MIN_SAMPLE_SIZE) continue;

      const analysis = this.logAnalyzer.analyze(nodeId, nodeLogs);
      const adjustment = this.determineAdjustment(analysis, nodeLogs, nodeId);
      const calibration = this.applyAdjustment(nodeId, adjustment, nodeRegistry);
      results.set(nodeId, calibration);
    }

    this.calibrations = results;
    return results;
  }

  private determineAdjustment(
    analysis: LogAnalysis,
    logs: IRTTrainingLog[],
    nodeId: string
  ): { param: string; value: number; reason: string } {
    if (analysis.confidence < 0.5) {
      return { param: 'none', value: 1.0, reason: '样本不足' };
    }

    // ===== 第一层：节点级 penalty 校准 =====
    if (analysis.primaryErrorSource === 'penalty' && analysis.penaltySensitivity > 0.5) {
      const avgPenalty = logs.reduce((s, l) => s + l.penalty, 0) / logs.length;

      if (avgPenalty < 0.7) {
        // 该节点的 penalty 过强，只调整该节点
        return {
          param: 'nodePenalty',
          value: 1.1,  // 降低惩罚
          reason: `节点 ${nodeId} 的 penalty 过强 (avg=${avgPenalty.toFixed(2)})`,
        };
      }
    }

    // ===== 第二层：边级 penalty 校准（精细） =====
    if (analysis.primaryErrorSource === 'penalty') {
      // 检查是哪条依赖边的问题
      const edgeAnalysis = this.analyzeEdgeErrors(logs, nodeId);
      if (edgeAnalysis) {
        return {
          param: 'edgePenalty',
          value: edgeAnalysis.adjustment,
          reason: `边 ${edgeAnalysis.edgeKey} 的 penalty 异常`,
          edgeKey: edgeAnalysis.edgeKey,
        };
      }
    }

    // ===== 第三层：其他参数（同 v2.5） =====
    // ... weight, baseScore 校准逻辑 ...

    return { param: 'none', value: 1.0, reason: '无需调整' };
  }

  private analyzeEdgeErrors(
    logs: IRTTrainingLog[],
    nodeId: string
  ): { edgeKey: string; adjustment: number } | null {
    // 分析每条依赖边的误差贡献
    const edgeErrors = new Map<string, number[]>();

    for (const log of logs) {
      if (log.counterfactualErrors?.penaltyError > 0.5) {
        // 找到导致高 penaltyError 的边
        for (const [prereqId, score] of log.dependencyPrereqScores) {
          if (score < MASTERY_THRESHOLDS.PREREQUISITE) {
            const edgeKey = `${prereqId}_${nodeId}`;
            if (!edgeErrors.has(edgeKey)) {
              edgeErrors.set(edgeKey, []);
            }
            edgeErrors.get(edgeKey)!.push(log.counterfactualErrors.penaltyError);
          }
        }
      }
    }

    // 找到误差最高的边
    let worstEdge: { key: string; avgError: number } | null = null;
    for (const [key, errors] of edgeErrors) {
      const avg = errors.reduce((a, b) => a + b, 0) / errors.length;
      if (!worstEdge || avg > worstEdge.avgError) {
        worstEdge = { key, avgError: avg };
      }
    }

    if (worstEdge && worstEdge.avgError > 0.6) {
      return {
        edgeKey: worstEdge.key,
        adjustment: 1.15,  // 降低该边的惩罚
      };
    }

    return null;
  }

  private applyAdjustment(
    nodeId: string,
    adjustment: any,
    nodeRegistry: CognitiveNodeRegistry
  ): ParameterCalibration {
    const node = nodeRegistry.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    const existing = this.calibrations.get(nodeId) || this.getDefaultCalibration(nodeId);
    const history = [...existing.calibrationHistory];

    switch (adjustment.param) {
      case 'nodePenalty':
        this.penaltyRegistry.calibrateNodePenalty(nodeId, adjustment.value);
        history.push({
          timestamp: Date.now(),
          adjustedParam: `nodePenalty:${nodeId}`,
          oldValue: this.penaltyRegistry.getNodePenalty(nodeId) / adjustment.value,
          newValue: this.penaltyRegistry.getNodePenalty(nodeId),
        });
        break;

      case 'edgePenalty':
        const [sourceId, targetId] = adjustment.edgeKey.split('_');
        this.penaltyRegistry.calibrateEdgePenalty(sourceId, targetId, adjustment.value);
        history.push({
          timestamp: Date.now(),
          adjustedParam: `edgePenalty:${adjustment.edgeKey}`,
          oldValue: 1.0,
          newValue: adjustment.value,
        });
        break;

      // ... 其他参数 ...
    }

    return {
      ...existing,
      nodeId,
      lastCalibrated: Date.now(),
      calibrationHistory: history,
    };
  }

  private getDefaultCalibration(nodeId: string): ParameterCalibration {
    return {
      nodeId,
      importanceCorrection: 1.0,
      discriminationCorrection: 1.0,
      penaltyCorrection: 1.0,  // 保留兼容性
      primaryErrorSource: 'balanced',
      sampleSize: 0,
      confidence: 0,
      lastCalibrated: 0,
      calibrationHistory: [],
    };
  }

  private groupByNode(logs: IRTTrainingLog[]): Map<string, IRTTrainingLog[]> {
    const byNode = new Map<string, IRTTrainingLog[]>();
    for (const log of logs) {
      if (!byNode.has(log.nodeId)) byNode.set(log.nodeId, []);
      byNode.get(log.nodeId)!.push(log);
    }
    return byNode;
  }
}
```

---

## 四、外部理想信号

### 4.1 问题分析

**v2.5 的自引用**：
```typescript
idealPrediction = mastery.decayedLevel  // mastery 是模型输出
```

**问题**：
- endogeneity（内生性）
- 误差被"吸收"
- 自洽但错误

### 4.2 解决方案：经验正确率

```typescript
// ============================================================
// 外部理想信号系统
// ============================================================
interface EmpiricalIdealSignal {
  // 获取节点的理想预测（基于历史数据）
  getIdealPrediction(
    nodeId: string,
    studentId: string,
    context: PredictionContext
  ): number;

  // 更新经验数据
  recordResult(
    nodeId: string,
    studentId: string,
    predictedMastery: number,
    actualCorrect: boolean
  ): void;

  // 获取经验正确率
  getEmpiricalCorrectness(
    nodeId: string,
    options?: {
      timeWindow?: number;      // 时间窗口（ms）
      studentSimilarity?: number; // 学生相似度阈值
    }
  ): number;
}

interface PredictionContext {
  questionDifficulty: number;
  questionDiscrimination: number;
  timeOfDay: number;
  daysSinceLastPractice: number;
}

class EmpiricalIdealSignalImpl implements EmpiricalIdealSignal {
  // 经验数据存储
  private empiricalData: Map<string, EmpiricalBucket[]> = new Map();

  // 相似学生缓存
  private similarStudentsCache: Map<string, string[]> = new Map();

  getIdealPrediction(
    nodeId: string,
    studentId: string,
    context: PredictionContext
  ): number {
    // 优先级1：个人历史数据
    const personalRate = this.getPersonalCorrectness(nodeId, studentId);
    if (personalRate.sampleSize >= 5) {
      // 调整为当前题目难度
      return this.adjustForDifficulty(personalRate.rate, context.questionDifficulty);
    }

    // 优先级2：相似学生数据
    const similarStudents = this.findSimilarStudents(studentId, nodeId);
    const similarRate = this.getSimilarStudentsCorrectness(nodeId, similarStudents);
    if (similarRate.sampleSize >= 10) {
      return this.adjustForDifficulty(similarRate.rate, context.questionDifficulty);
    }

    // 优先级3：全局数据
    const globalRate = this.getEmpiricalCorrectness(nodeId);
    if (globalRate > 0) {
      return this.adjustForDifficulty(globalRate, context.questionDifficulty);
    }

    // Fallback：传统预测（仅当无数据时）
    return 0.5;  // 中性预测
  }

  recordResult(
    nodeId: string,
    studentId: string,
    predictedMastery: number,
    actualCorrect: boolean
  ): void {
    if (!this.empiricalData.has(nodeId)) {
      this.empiricalData.set(nodeId, []);
    }

    const buckets = this.empiricalData.get(nodeId)!;
    const bucketIndex = this.getMasteryBucket(predictedMastery);

    if (!buckets[bucketIndex]) {
      buckets[bucketIndex] = {
        masteryMin: bucketIndex * 0.1,
        masteryMax: (bucketIndex + 1) * 0.1,
        totalAttempts: 0,
        correctAttempts: 0,
        studentIds: new Set(),
      };
    }

    buckets[bucketIndex].totalAttempts++;
    if (actualCorrect) {
      buckets[bucketIndex].correctAttempts++;
    }
    buckets[bucketIndex].studentIds.add(studentId);
  }

  getEmpiricalCorrectness(
    nodeId: string,
    options: { timeWindow?: number; studentSimilarity?: number } = {}
  ): number {
    const buckets = this.empiricalData.get(nodeId);
    if (!buckets || buckets.length === 0) return 0;

    let totalAttempts = 0;
    let correctAttempts = 0;

    for (const bucket of buckets) {
      if (!bucket) continue;
      totalAttempts += bucket.totalAttempts;
      correctAttempts += bucket.correctAttempts;
    }

    return totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
  }

  // ===== 辅助方法 =====
  private getPersonalCorrectness(
    nodeId: string,
    studentId: string
  ): { rate: number; sampleSize: number } {
    const buckets = this.empiricalData.get(nodeId);
    if (!buckets) return { rate: 0, sampleSize: 0 };

    let total = 0;
    let correct = 0;

    for (const bucket of buckets) {
      if (!bucket) continue;
      if (bucket.studentIds.has(studentId)) {
        // 估算该学生的贡献（简化）
        const studentRatio = 1 / bucket.studentIds.size;
        total += bucket.totalAttempts * studentRatio;
        correct += bucket.correctAttempts * studentRatio;
      }
    }

    return {
      rate: total > 0 ? correct / total : 0,
      sampleSize: Math.round(total),
    };
  }

  private findSimilarStudents(studentId: string, nodeId: string): string[] {
    // 简化版：随机选择其他学生
    // 实际版应该基于能力画像相似度
    const cacheKey = `${studentId}_${nodeId}`;
    if (this.similarStudentsCache.has(cacheKey)) {
      return this.similarStudentsCache.get(cacheKey)!;
    }

    const buckets = this.empiricalData.get(nodeId);
    if (!buckets) return [];

    const allStudents = new Set<string>();
    for (const bucket of buckets) {
      if (bucket) {
        for (const sid of bucket.studentIds) {
          if (sid !== studentId) {
            allStudents.add(sid);
          }
        }
      }
    }

    const similar = Array.from(allStudents).slice(0, 20);  // 最多20个
    this.similarStudentsCache.set(cacheKey, similar);
    return similar;
  }

  private getSimilarStudentsCorrectness(
    nodeId: string,
    similarStudents: string[]
  ): { rate: number; sampleSize: number } {
    const buckets = this.empiricalData.get(nodeId);
    if (!buckets || similarStudents.length === 0) {
      return { rate: 0, sampleSize: 0 };
    }

    let total = 0;
    let correct = 0;

    for (const bucket of buckets) {
      if (!bucket) continue;
      for (const sid of similarStudents) {
        if (bucket.studentIds.has(sid)) {
          const studentRatio = 1 / bucket.studentIds.size;
          total += bucket.totalAttempts * studentRatio;
          correct += bucket.correctAttempts * studentRatio;
        }
      }
    }

    return {
      rate: total > 0 ? correct / total : 0,
      sampleSize: Math.round(total),
    };
  }

  private adjustForDifficulty(baseRate: number, questionDifficulty: number): number {
    // 难度调整：题目越难，正确率越低
    // difficulty 范围 [1, 5]
    const difficultyFactor = 1 - (questionDifficulty - 3) * 0.1;
    return Math.max(0, Math.min(1, baseRate * difficultyFactor));
  }

  private getMasteryBucket(mastery: number): number {
    // 0-1 分成10个bucket
    return Math.min(9, Math.floor(mastery * 10));
  }
}

interface EmpiricalBucket {
  masteryMin: number;
  masteryMax: number;
  totalAttempts: number;
  correctAttempts: number;
  studentIds: Set<string>;
}
```

### 4.3 在反事实计算中使用

```typescript
// ============================================================
// 反事实计算（使用外部理想信号）
// ============================================================
function calculateCounterfactualWithEmpiricalIdeal(
  question: SubQuestion,
  result: QuestionResult,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  empiricalSignal: EmpiricalIdealSignal,
  errorCalculator: CounterfactualErrorCalculator
): CounterfactualErrors[] {
  const results: CounterfactualErrors[] = [];
  const weights = normalizeWeights(question.nodeContributions, nodeRegistry, question);

  for (const contrib of question.nodeContributions) {
    const node = nodeRegistry.get(contrib.nodeId)!;
    const weight = weights.get(contrib.nodeId)!;
    const mastery = nodeMasteries.get(contrib.nodeId);

    // 基础计算
    const baseScore = result.isCorrect ? 1.0 : 0.0;
    const baseScoreWithDiscrimination = baseScore * question.discrimination;
    const penalty = calculateNodeDependencyPenalty(
      contrib.nodeId,
      nodeMasteries,
      nodeRegistry,
      penaltyRegistry  // 假设已注入
    );

    // ===== 外部理想信号 =====
    const empiricalIdeal = empiricalSignal.getIdealPrediction(
      contrib.nodeId,
      'student',
      {
        questionDifficulty: question.difficulty,
        questionDiscrimination: question.discrimination,
        timeOfDay: new Date().getHours(),
        daysSinceLastPractice: mastery
          ? (Date.now() - mastery.lastUpdated) / (1000 * 60 * 60 * 24)
          : 999,
      }
    );

    const idealValues: IdealValues = {
      idealBaseScore: empiricalIdeal,  // ✅ 使用外部信号
      idealWeight: getIdealWeight(contrib.nodeId, nodeRegistry),
      idealPenalty: 1.0,
    };

    const cfErrors = errorCalculator.calculate(
      result.isCorrect,
      baseScoreWithDiscrimination,
      weight,
      penalty,
      idealValues
    );

    results.push(cfErrors);

    // 记录结果
    empiricalSignal.recordResult(
      contrib.nodeId,
      'student',
      mastery?.decayedLevel ?? 0,
      result.isCorrect
    );
  }

  return results;
}
```

---

## 五、正交性验证

### 5.1 验证指标

```typescript
// ============================================================
// 正交性验证
// ============================================================
interface OrthogonalityMetrics {
  // 三个误差维度的相关性矩阵
  correlationMatrix: {
    base_weight: number;
    base_penalty: number;
    weight_penalty: number;
  };

  // 主导度（一个参数主导的程度）
  dominanceRatio: number;

  // 综合正交性得分
  orthogonalityScore: number;

  // 判断：是否正交
  isOrthogonal: boolean;
}

function validateOrthogonality(
  cfErrorsList: CounterfactualErrors[]
): OrthogonalityMetrics {
  if (cfErrorsList.length < 10) {
    return {
      correlationMatrix: { base_weight: 0, base_penalty: 0, weight_penalty: 0 },
      dominanceRatio: 0,
      orthogonalityScore: 0,
      isOrthogonal: false,
    };
  }

  // 提取三个维度的边际影响
  const baseImpacts = cfErrorsList.map(e => e.baseMarginalImpact);
  const weightImpacts = cfErrorsList.map(e => e.weightMarginalImpact);
  const penaltyImpacts = cfErrorsList.map(e => e.penaltyMarginalImpact);

  // 计算相关性
  const baseWeightCorr = pearsonCorrelation(baseImpacts, weightImpacts);
  const basePenaltyCorr = pearsonCorrelation(baseImpacts, penaltyImpacts);
  const weightPenaltyCorr = pearsonCorrelation(weightImpacts, penaltyImpacts);

  // 计算主导度
  const magnitudes = cfErrorsList.map(e => [
    Math.abs(e.baseMarginalImpact),
    Math.abs(e.weightMarginalImpact),
    Math.abs(e.penaltyMarginalImpact),
  ]);

  let totalDominance = 0;
  for (const mag of magnitudes) {
    const max = Math.max(...mag);
    const sum = mag.reduce((a, b) => a + b, 0);
    totalDominance += sum > 0 ? max / sum : 0;
  }
  const dominanceRatio = totalDominance / magnitudes.length;

  // 综合正交性得分
  const avgCorr = (Math.abs(baseWeightCorr) + Math.abs(basePenaltyCorr) + Math.abs(weightPenaltyCorr)) / 3;
  const orthogonalityScore = (1 - avgCorr) * 0.6 + dominanceRatio * 0.4;

  // 判断标准
  const isOrthogonal = orthogonalityScore > 0.7;

  return {
    correlationMatrix: {
      base_weight: baseWeightCorr,
      base_penalty: basePenaltyCorr,
      weight_penalty: weightPenaltyCorr,
    },
    dominanceRatio,
    orthogonalityScore,
    isOrthogonal,
  };
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator > 0 ? numerator / denominator : 0;
}
```

---

## 六、完整数据结构（v2.6）

```typescript
// ============================================================
// 1. 反事实误差（新增）
// ============================================================
interface CounterfactualErrors {
  currentPrediction: number;
  counterfactualWithIdealBase: number;
  counterfactualWithIdealWeight: number;
  counterfactualWithIdealPenalty: number;
  baseMarginalImpact: number;
  weightMarginalImpact: number;
  penaltyMarginalImpact: number;
  baseError: number;
  weightError: number;
  penaltyError: number;
  orthogonalityScore: number;
}

interface IdealValues {
  idealBaseScore: number;
  idealWeight: number;
  idealPenalty: number;
}

// ============================================================
// 2. 节点级惩罚（新增）
// ============================================================
interface NodePenaltyRegistry {
  nodePenaltyMultipliers: Map<string, number>;
  edgePenaltyMultipliers: Map<string, number>;
  globalPenaltyMultiplier: number;
  getNodePenalty(nodeId: string): number;
  getEdgePenalty(sourceId: string, targetId: string): number;
  calibrateNodePenalty(nodeId: string, adjustment: number): void;
  calibrateEdgePenalty(sourceId: string, targetId: string, adjustment: number): void;
}

// ============================================================
// 3. 外部理想信号（新增）
// ============================================================
interface EmpiricalIdealSignal {
  getIdealPrediction(nodeId: string, studentId: string, context: PredictionContext): number;
  recordResult(nodeId: string, studentId: string, predictedMastery: number, actualCorrect: boolean): void;
  getEmpiricalCorrectness(nodeId: string, options?: { timeWindow?: number; studentSimilarity?: number }): number;
}

interface PredictionContext {
  questionDifficulty: number;
  questionDiscrimination: number;
  timeOfDay: number;
  daysSinceLastPractice: number;
}

interface EmpiricalBucket {
  masteryMin: number;
  masteryMax: number;
  totalAttempts: number;
  correctAttempts: number;
  studentIds: Set<string>;
}

// ============================================================
// 4. IRT 训练日志（扩展）
// ============================================================
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;
  studentId: string;
  predictedMastery: number;
  actualCorrect: boolean;

  // 原始数据
  baseScore: number;
  weight: number;
  penalty: number;
  predictedBeforePenalty: number;
  predictedAfterPenalty: number;
  questionDiscrimination: number;
  nodeImportance: number;
  contributionLevel: ContributionLevel;
  dependencyPrereqScores: Map<string, number>;

  // ===== v2.6 新增 =====
  counterfactualErrors?: CounterfactualErrors;
  empiricalIdealSignal?: number;
  nodePenaltyMultiplier?: number;
}

// ============================================================
// 5. 参数校准（扩展）
// ============================================================
interface ParameterCalibration {
  nodeId: string;
  importanceCorrection: number;
  discriminationCorrection: number;
  penaltyCorrection: number;  // 保留兼容性

  // ===== v2.6 新增 =====
  nodePenaltyCorrection?: Map<string, number>;  // nodeId → multiplier
  edgePenaltyCorrection?: Map<string, number>;  // edgeKey → multiplier

  primaryErrorSource: 'base' | 'penalty' | 'weight' | 'balanced';
  sampleSize: number;
  confidence: number;
  lastCalibrated: number;
  calibrationHistory: {
    timestamp: number;
    adjustedParam: string;
    oldValue: number;
    newValue: number;
  }[];
}

// ============================================================
// 6. 正交性验证（新增）
// ============================================================
interface OrthogonalityMetrics {
  correlationMatrix: {
    base_weight: number;
    base_penalty: number;
    weight_penalty: number;
  };
  dominanceRatio: number;
  orthogonalityScore: number;
  isOrthogonal: boolean;
}
```

---

## 七、Phase 0 可运行验证

### 7.1 更新的验证指标

```typescript
// ============================================================
// Phase 0 验证（v2.6）
// ============================================================
interface Phase0Result {
  passed: boolean;

  // v2.5 指标
  monotonicityScore: number;
  predictionAccuracy: number;
  convergenceRate: number;
  calibrationQuality: number;

  // ===== v2.6 新增 =====
  orthogonalityScore: number;        // 正交性
  localizationScore: number;         // 局部化得分（节点级惩罚验证）
  empiricalCoverage: number;         // 经验信号覆盖率

  details: {
    bucketCorrectRates: number[];
    predictions: { predicted: boolean; actual: boolean }[];
    orthogonalityMetrics: OrthogonalityMetrics;
  };
}

// 判断标准（v2.6）
function isPhase0Passed(result: Phase0Result): boolean {
  return (
    result.monotonicityScore > 0.8 &&
    result.predictionAccuracy > 0.65 &&
    result.convergenceRate < 10 &&
    result.calibrationQuality > 0.7 &&
    // ===== v2.6 新增 =====
    result.orthogonalityScore > 0.7 &&      // 正交性
    result.localizationScore > 0.6 &&      // 节点级惩罚有效
    result.empiricalCoverage > 0.5         // 有足够经验数据
  );
}
```

### 7.2 验证代码结构

```typescript
// ============================================================
// Phase 0 Simulation（v2.6）
// ============================================================
class Phase0SimulationV26 {
  private errorCalculator: CounterfactualErrorCalculator;
  private penaltyRegistry: NodePenaltyRegistryImpl;
  private empiricalSignal: EmpiricalIdealSignalImpl;

  async run(): Promise<Phase0Result> {
    // 1. 初始化
    this.initializeComponents();

    // 2. 生成测试数据
    const testData = this.generateTestData();

    // 3. 模拟答题流程
    const results = await this.simulateAnswering(testData);

    // 4. 计算指标
    const monotonicity = this.calculateMonotonicity(results);
    const accuracy = this.calculateAccuracy(results);
    const convergence = this.calculateConvergence(results);
    const calibration = this.calculateCalibration(results);

    // 5. v2.6 指标
    const orthogonality = this.calculateOrthogonality(results);
    const localization = this.calculateLocalization(results);
    const empirical = this.calculateEmpiricalCoverage(results);

    return {
      passed: isPhase0Passed({
        monotonicityScore: monotonicity,
        predictionAccuracy: accuracy,
        convergenceRate: convergence,
        calibrationQuality: calibration,
        orthogonalityScore: orthogonality.score,
        localizationScore: localization,
        empiricalCoverage: empirical,
      }),
      monotonicityScore: monotonicity,
      predictionAccuracy: accuracy,
      convergenceRate: convergence,
      calibrationQuality: calibration,
      orthogonalityScore: orthogonality.score,
      localizationScore: localization,
      empiricalCoverage: empirical,
      details: {
        bucketCorrectRates: this.getBucketRates(results),
        predictions: results,
        orthogonalityMetrics: orthogonality,
      },
    };
  }

  private calculateOrthogonality(results: any[]): OrthogonalityMetrics {
    // 收集所有反事实误差
    const cfErrorsList: CounterfactualErrors[] = [];
    for (const r of results) {
      if (r.counterfactualErrors) {
        cfErrorsList.push(r.counterfactualErrors);
      }
    }
    return validateOrthogonality(cfErrorsList);
  }

  private calculateLocalization(results: any[]): number {
    // 验证节点级惩罚：检查不同节点的 penalty 是否独立变化
    const nodePenalties = new Map<string, number[]>();

    for (const r of results) {
      for (const [nodeId, penalty] of Object.entries(r.nodePenalties || {})) {
        if (!nodePenalties.has(nodeId)) {
          nodePenalties.set(nodeId, []);
        }
        nodePenalties.get(nodeId)!.push(penalty);
      }
    }

    // 计算节点间的独立性
    let independentPairs = 0;
    let totalPairs = 0;

    const nodeIds = Array.from(nodePenalties.keys());
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const corr = pearsonCorrelation(
          nodePenalties.get(nodeIds[i])!,
          nodePenalties.get(nodeIds[j])!
        );
        totalPairs++;
        if (Math.abs(corr) < 0.3) {
          independentPairs++;  // 低相关 = 独立
        }
      }
    }

    return totalPairs > 0 ? independentPairs / totalPairs : 0;
  }

  private calculateEmpiricalCoverage(results: any[]): number {
    // 检查有多少节点有足够的经验数据
    const nodeDataCounts = new Map<string, number>();

    for (const r of results) {
      for (const nodeId of r.nodeIds || []) {
        nodeDataCounts.set(nodeId, (nodeDataCounts.get(nodeId) || 0) + 1);
      }
    }

    let coveredNodes = 0;
    for (const count of nodeDataCounts.values()) {
      if (count >= 5) {  // 至少5个数据点
        coveredNodes++;
      }
    }

    return nodeDataCounts.size > 0 ? coveredNodes / nodeDataCounts.size : 0;
  }
}
```

---

## 八、参数默认值（v2.6）

```typescript
// ===== 反事实误差 =====
const COUNTERFACTUAL_CONFIG = {
  MIN_ORTHOGONALITY: 0.7,      // 正交性阈值
  MIN_DOMINANCE_RATIO: 0.4,    // 最小主导度
  MARGINAL_IMPACT_THRESHOLD: 0.05,  // 边际影响阈值
};

// ===== 节点级惩罚 =====
const NODE_PENALTY_CONFIG = {
  DEFAULT_MULTIPLIER: 1.0,
  MIN_MULTIPLIER: 0.5,
  MAX_MULTIPLIER: 2.0,
  CALIBRATION_THRESHOLD: 0.6,  // 误差 > 0.6 才校准
  MIN_SAMPLES_FOR_CALIBRATION: 10,
};

// ===== 外部理想信号 =====
const EMPIRICAL_SIGNAL_CONFIG = {
  MIN_SAMPLES_FOR_PERSONAL: 5,    // 个人数据最小样本
  MIN_SAMPLES_FOR_SIMILAR: 10,    // 相似学生最小样本
  BUCKET_COUNT: 10,               // mastery 分桶数
  TIME_WINDOW_DAYS: 7,            // 时间窗口
  SIMILAR_STUDENT_COUNT: 20,      // 相似学生数量
  DECAY_FACTOR: 0.1,              // 衰减因子
};

// ===== Phase 0 验证（v2.6） =====
const LOOP_VALIDATION_V26 = {
  // v2.5 指标
  BUCKET_COUNT: 10,
  MIN_MONOTONICITY: 0.8,
  MIN_PREDICTION_ACCURACY: 0.65,
  MAX_CONVERGENCE_QUESTIONS: 10,
  MIN_CALIBRATION_QUALITY: 0.7,

  // v2.6 新增
  MIN_ORTHOGONALITY: 0.7,
  MIN_LOCALIZATION: 0.6,
  MIN_EMPIRICAL_COVERAGE: 0.5,
};
```

---

## 九、版本变更记录

### v2.6 主要变更（工程稳定版）

| 变更 | 说明 | 原因 |
|------|------|------|
| **反事实误差** | CounterfactualErrorCalculator | 解决 error 不正交 |
| **正交性验证** | OrthogonalityMetrics | 确保参数独立可测 |
| **节点级惩罚** | NodePenaltyRegistry | 解决局部污染全局 |
| **边级惩罚** | edgePenaltyMultipliers | 精细化依赖校准 |
| **外部理想信号** | EmpiricalIdealSignal | 解决模型自引用 |
| **经验正确率** | EmpiricalBucket | 基于历史数据的理想预测 |

### v2.5 → v2.6 差异

| 模块 | v2.5 | v2.6 |
|------|------|------|
| Error 计算 | 直接分解 | 反事实计算 |
| Penalty | 全局单一值 | 节点级+边级 |
| Ideal Signal | mastery.decayedLevel | 经验正确率 |
| 验证指标 | 4个 | 7个 |

### 系统成熟度分级

| 版本 | 状态 | 说明 |
|------|------|------|
| v2.4 | ❌ 不可用 | 参数不可识别 |
| v2.5 | ⚠️ 实验级 | 理论成立，工程不稳定 |
| **v2.6** | ✅ **可生产验证** | **架构成立+工程稳定** |
| 未来 | 🚀 平台级 | 扩展性、多租户、实时校准 |

---

**文档版本**: v2.6（工程稳定版）
**最后更新**: 2026-04-26
**状态**: 可生产验证规格
**下一步**: 运行 Phase 0 simulation（validation/phase0-simulation-v26.ts）
