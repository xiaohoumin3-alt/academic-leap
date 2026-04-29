# Question Graph 架构设计文档 v2.5（可识别系统）

**日期**: 2026-04-26
**状态**: 系统可识别 + 可收敛
**作者**: AI + 用户头脑风暴 + 多轮架构评审 + 系统化修正

---

## v2.5 核心修正

> **v2.5 目标：解决"可学习 ≠ 可识别"问题，确保参数可分解、可归因。**

本版本基于 v2.4，修正5个关键问题：
1. **可分解日志** → 拆解 attribution，每个组件独立可观测
2. **分层校准** → penalty/weight/baseScore 三层归因
3. **单参数约束** → 每轮只调一个参数，防止震荡
4. **策略题型** → 让 strategy mastery 可观测
5. **Pattern gating** → 高能力学生不误判

---

## 目录

- [一、v2.5 变更说明](#一v25-变更说明)
- [二、可分解日志系统](#二可分解日志系统)
- [三、分层校准机制](#三分层校准机制)
- [四、策略专用题型](#四策略专用题型)
- [五、Pattern 阈值修正](#五pattern-阈值修正)
- [六、完整数据结构](#六完整数据结构)
- [七、Phase 0 可运行验证](#七phase-0-可运行验证)

---

## 一、v2.5 变更说明

### 1.1 五大修正

| # | 问题 | v2.4 | v2.5 |
|---|------|------|------|
| 1 | 参数不可识别 | 整体误差 | **可分解日志** |
| 2 | 校准方向混乱 | 整体修正 | **分层校准** |
| 3 | 参数震荡 | 同时调多参数 | **单参数约束** |
| 4 | Strategy 不可观测 | 无题型 | **策略专用题型** |
| 5 | 高能力误判 | 无阈值 | **Pattern gating** |

### 1.2 设计哲学

> **可识别性（Identifiability）> 复杂度**

如果一个参数的变化无法从观测数据中区分，这个参数就不应该存在。

v2.5 的核心原则：
1. **每个参数必须独立可观测**
2. **每个误差必须可归因到单一源头**
3. **每次校准只调整一个维度**

---

## 二、可分解日志系统

### 2.1 问题诊断

**v2.4 的日志**：

```typescript
// ❌ 只记录最终误差
calibrationError = |predictedMastery - actualCorrect|
```

**问题**：误差来源不明确

```
effectiveScore = baseScore × penalty × weight

误差到底来自：
- baseScore 错了？
- penalty 错了？
- weight 错了？
```

---

### 2.2 解决方案：可分解日志

#### 第一步：扩展日志结构

```typescript
// ============================================================
// IRT 训练日志（可分解版）
// ============================================================
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;
  studentId: string;

  // ===== 预测 vs 实际 =====
  predictedMastery: number;
  actualCorrect: boolean;

  // ===== 可分解项（新增） =====
  baseScore: number;              // 基础得分（基于答题结果）
  weight: number;                 // 归一化后的权重
  penalty: number;                // 依赖惩罚

  // ===== 中间预测（新增） =====
  predictedBeforePenalty: number;  // baseScore × weight
  predictedAfterPenalty: number;   // × penalty

  // ===== 参数上下文 =====
  questionDiscrimination: number;
  nodeImportance: number;

  // ===== 误差分解（新增） =====
  baseError: number;              // baseScore 的误差
  penaltyError: number;           // penalty 的误差
  weightError: number;            // weight 的误差

  // ===== 原始数据 =====
  contributionLevel: ContributionLevel;
  dependencyPrereqScores: Map<string, number>;  // 前置节点的掌握度
}
```

#### 第二步：在归因计算中收集分解数据

```typescript
// ============================================================
// 归因计算（可分解版）
// ============================================================
function attributeResult(
  question: SubQuestion,
  result: QuestionResult,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  irtLogger?: IRTLogger
): AttributedResult {
  const attributions = new Map<string, NodeAttribution>();
  const weights = normalizeWeights(question.nodeContributions, nodeRegistry, question);

  for (const contrib of question.nodeContributions) {
    const node = nodeRegistry.get(contrib.nodeId)!;
    const weight = weights.get(contrib.nodeId)!;
    const mastery = nodeMasteries.get(contrib.nodeId);

    // ===== 步骤1: 基础得分 =====
    const baseScore = result.isCorrect ? 1.0 : 0.0;
    const baseScoreWithDiscrimination = baseScore * question.discrimination;

    // ===== 步骤2: 权重后 =====
    const predictedBeforePenalty = baseScoreWithDiscrimination * weight;

    // ===== 步骤3: 依赖惩罚 =====
    const penalty = calculateDependencyPenalty(contrib.nodeId, nodeMasteries, nodeRegistry);
    const predictedAfterPenalty = predictedBeforePenalty * penalty;

    // ===== 最终有效得分 =====
    const effectiveScore = predictedAfterPenalty;

    // ===== 误差分解 =====
    // 理想预测：如果 mastery 准确，应该预测什么？
    const idealPrediction = mastery ? (result.isCorrect ? mastery.decayedLevel : 1 - mastery.decayedLevel) : 0.5;

    const baseError = Math.abs(baseScoreWithDiscrimination - idealPrediction);
    const penaltyError = Math.abs(predictedAfterPenalty - predictedBeforePenalty);
    const weightError = Math.abs(predictedBeforePenalty - baseScoreWithDiscrimination);

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

    // ===== 可分解日志 =====
    if (irtLogger && mastery) {
      // 收集前置节点得分
      const prereqScores = new Map<string, number>();
      for (const dep of node.dependencies) {
        const prereqMastery = nodeMasteries.get(dep.prerequisiteId);
        prereqScores.set(dep.prerequisiteId, prereqMastery ? prereqMastery.decayedLevel : 0);
      }

      irtLogger.log({
        timestamp: Date.now(),
        nodeId: contrib.nodeId,
        questionId: question.questionId,
        studentId: 'student',  // 从上下文获取

        predictedMastery: mastery.decayedLevel,
        actualCorrect: result.isCorrect,

        // 可分解项
        baseScore: baseScoreWithDiscrimination,
        weight,
        penalty,
        predictedBeforePenalty,
        predictedAfterPenalty,

        // 参数上下文
        questionDiscrimination: question.discrimination,
        nodeImportance: node.importance,

        // 误差分解
        baseError,
        penaltyError,
        weightError,

        // 原始数据
        contributionLevel: contrib.level,
        dependencyPrereqScores: prereqScores,
      });
    }
  }

  return {
    questionId: question.questionId,
    isCorrect: result.isCorrect,
    primaryNodeId: question.nodeContributions[0].nodeId,
    attributions,
  };
}
```

#### 第三步：日志分析器

```typescript
// ============================================================
// 日志分析器（新增）
// ============================================================
interface LogAnalysis {
  nodeId: string;

  // 误差来源分析
  primaryErrorSource: 'base' | 'penalty' | 'weight' | 'balanced';
  baseErrorAvg: number;
  penaltyErrorAvg: number;
  weightErrorAvg: number;

  // 参数敏感性
  penaltySensitivity: number;  // penalty 对误差的影响程度
  weightSensitivity: number;

  // 样本信息
  sampleSize: number;
  confidence: number;
}

class LogAnalyzer {
  analyze(nodeId: string, logs: IRTTrainingLog[]): LogAnalysis {
    const nodeLogs = logs.filter(l => l.nodeId === nodeId);

    if (nodeLogs.length < 10) {
      return {
        nodeId,
        primaryErrorSource: 'balanced',
        baseErrorAvg: 0,
        penaltyErrorAvg: 0,
        weightErrorAvg: 0,
        penaltySensitivity: 0,
        weightSensitivity: 0,
        sampleSize: nodeLogs.length,
        confidence: 0,
      };
    }

    // 计算平均误差
    const baseErrorAvg = nodeLogs.reduce((s, l) => s + l.baseError, 0) / nodeLogs.length;
    const penaltyErrorAvg = nodeLogs.reduce((s, l) => s + l.penaltyError, 0) / nodeLogs.length;
    const weightErrorAvg = nodeLogs.reduce((s, l) => s + l.weightError, 0) / nodeLogs.length;

    // 判断主要误差来源
    const errors = [baseErrorAvg, penaltyErrorAvg, weightErrorAvg];
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);
    const errorRange = maxError - minError;

    let primaryErrorSource: 'base' | 'penalty' | 'weight' | 'balanced';
    if (errorRange < 0.05) {
      primaryErrorSource = 'balanced';
    } else if (baseErrorAvg === maxError) {
      primaryErrorSource = 'base';
    } else if (penaltyErrorAvg === maxError) {
      primaryErrorSource = 'penalty';
    } else {
      primaryErrorSource = 'weight';
    }

    // 计算敏感性
    const penaltySensitivity = this.calculateSensitivity(nodeLogs, 'penalty');
    const weightSensitivity = this.calculateSensitivity(nodeLogs, 'weight');

    // 样本置信度
    const confidence = Math.min(1.0, nodeLogs.length / 50);  // 50样本达到满置信

    return {
      nodeId,
      primaryErrorSource,
      baseErrorAvg,
      penaltyErrorAvg,
      weightErrorAvg,
      penaltySensitivity,
      weightSensitivity,
      sampleSize: nodeLogs.length,
      confidence,
    };
  }

  private calculateSensitivity(
    logs: IRTTrainingLog[],
    param: 'penalty' | 'weight'
  ): number {
    // 计算参数变化与误差变化的相关性
    const n = logs.length;
    if (n < 2) return 0;

    const paramValues = logs.map(l => param === 'penalty' ? l.penalty : l.weight);
    const errors = logs.map(l => l.baseError);

    // 简单相关系数
    const meanParam = paramValues.reduce((a, b) => a + b) / n;
    const meanError = errors.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let sumSqParam = 0;
    let sumSqError = 0;

    for (let i = 0; i < n; i++) {
      const diffParam = paramValues[i] - meanParam;
      const diffError = errors[i] - meanError;
      numerator += diffParam * diffError;
      sumSqParam += diffParam * diffParam;
      sumSqError += diffError * diffError;
    }

    const denominator = Math.sqrt(sumSqParam * sumSqError);
    if (denominator === 0) return 0;

    return Math.abs(numerator / denominator);
  }
}
```

---

## 三、分层校准机制

### 3.1 问题诊断

**v2.4 的校准**：

```typescript
// ❌ 同时修正多个参数
importanceCorrection = 1 - avgError * 0.1
discriminationCorrection = ...
```

**问题**：参数震荡，不收敛

---

### 3.2 解决方案：分层归因 + 单参数约束

#### 第一步：扩展校准结构

```typescript
// ============================================================
// 参数校准（分层版）
// ============================================================
interface ParameterCalibration {
  nodeId: string;

  // 分层修正
  importanceCorrection: number;
  discriminationCorrection: number;
  penaltyCorrection: number;  // ✅ 新增

  // 误差归因
  primaryErrorSource: 'base' | 'penalty' | 'weight' | 'balanced';

  // 校准质量
  sampleSize: number;
  confidence: number;
  lastCalibrated: number;

  // 校准历史（用于检测震荡）
  calibrationHistory: {
    timestamp: number;
    adjustedParam: string;
    oldValue: number;
    newValue: number;
  }[];
}
```

#### 第二步：三层校准逻辑

```typescript
// ============================================================
// 参数校准器（分层版）
// ============================================================
class LayeredParameterCalibrator {
  private logAnalyzer: LogAnalyzer;
  private calibrations: Map<string, ParameterCalibration> = new Map();

  // ===== 核心校准方法 =====
  calibrate(
    logs: IRTTrainingLog[],
    nodeRegistry: CognitiveNodeRegistry
  ): Map<string, ParameterCalibration> {
    const byNode = this.groupByNode(logs);
    const results = new Map<string, ParameterCalibration>();

    for (const [nodeId, nodeLogs] of byNode) {
      if (nodeLogs.length < CALIBRATION_CONFIG.MIN_SAMPLE_SIZE) continue;

      // 第一步：分析日志
      const analysis = this.logAnalyzer.analyze(nodeId, nodeLogs);

      // 第二步：决定调整哪个参数
      const adjustment = this.determineAdjustment(analysis, nodeLogs);

      // 第三步：应用调整
      const calibration = this.applyAdjustment(nodeId, adjustment, nodeRegistry);
      results.set(nodeId, calibration);
    }

    this.calibrations = results;
    return results;
  }

  // ===== 决定调整哪个参数（单参数约束） =====
  private determineAdjustment(
    analysis: LogAnalysis,
    logs: IRTTrainingLog[]
  ): { param: string; value: number; reason: string } {
    // 🔒 约束：每轮只调整一个参数

    if (analysis.confidence < 0.5) {
      return { param: 'none', value: 1.0, reason: '样本不足' };
    }

    // ===== 第一层：检查 penalty 是否过强 =====
    if (analysis.primaryErrorSource === 'penalty' && analysis.penaltySensitivity > 0.5) {
      const avgPenalty = logs.reduce((s, l) => s + l.penalty, 0) / logs.length;

      if (avgPenalty < 0.7) {
        // penalty 太强，降低依赖惩罚系数
        return {
          param: 'penalty',
          value: 1.1,  // 提高 penalty 系数（让惩罚变弱）
          reason: `penalty 过强 (avg=${avgPenalty.toFixed(2)})`
        };
      }
    }

    // ===== 第二层：检查 weight 是否有问题 =====
    if (analysis.primaryErrorSource === 'weight' && analysis.weightSensitivity > 0.5) {
      const avgWeight = logs.reduce((s, l) => s + l.weight, 0) / logs.length;

      if (avgWeight < 0.3 || avgWeight > 0.7) {
        // weight 异常，调整 importance
        const correction = avgWeight < 0.3 ? 1.2 : 0.8;
        return {
          param: 'importance',
          value: correction,
          reason: `weight 异常 (avg=${avgWeight.toFixed(2)})`
        };
      }
    }

    // ===== 第三层：检查 baseScore =====
    if (analysis.primaryErrorSource === 'base') {
      // discrimination 问题，但谨慎调整
      const avgBaseError = analysis.baseErrorAvg;
      if (avgBaseError > 0.3) {
        return {
          param: 'discrimination',
          value: 0.95,  // 轻微降低
          reason: `baseScore 误差高 (avg=${avgBaseError.toFixed(2)})`
        };
      }
    }

    return { param: 'none', value: 1.0, reason: '无需调整' };
  }

  // ===== 应用调整 =====
  private applyAdjustment(
    nodeId: string,
    adjustment: { param: string; value: number; reason: string },
    nodeRegistry: CognitiveNodeRegistry
  ): ParameterCalibration {
    const node = nodeRegistry.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const existing = this.calibrations.get(nodeId) || {
      nodeId,
      importanceCorrection: 1.0,
      discriminationCorrection: 1.0,
      penaltyCorrection: 1.0,
      primaryErrorSource: 'balanced',
      sampleSize: 0,
      confidence: 0,
      lastCalibrated: 0,
      calibrationHistory: [],
    };

    // 记录历史
    const history = [...existing.calibrationHistory];

    // 应用调整
    switch (adjustment.param) {
      case 'importance':
        node.importance *= adjustment.value;
        node.importance = Math.max(0.1, Math.min(1.0, node.importance));
        existing.importanceCorrection = adjustment.value;
        history.push({
          timestamp: Date.now(),
          adjustedParam: 'importance',
          oldValue: node.importance / adjustment.value,
          newValue: node.importance,
        });
        break;

      case 'discrimination':
        existing.discriminationCorrection = adjustment.value;
        // discrimination 在题目层面，不直接修改节点
        history.push({
          timestamp: Date.now(),
          adjustedParam: 'discrimination',
          oldValue: 1.0,
          newValue: adjustment.value,
        });
        break;

      case 'penalty':
        existing.penaltyCorrection = adjustment.value;
        // 修改全局依赖惩罚系数
        history.push({
          timestamp: Date.now(),
          adjustedParam: 'penalty',
          oldValue: 1.0,
          newValue: adjustment.value,
        });
        break;
    }

    return {
      ...existing,
      nodeId,
      lastCalibrated: Date.now(),
      calibrationHistory: history,
    };
  }

  private groupByNode(logs: IRTTrainingLog[]): Map<string, IRTTrainingLog[]> {
    const byNode = new Map<string, IRTTrainingLog[]>();
    for (const log of logs) {
      if (!byNode.has(log.nodeId)) {
        byNode.set(log.nodeId, []);
      }
      byNode.get(log.nodeId)!.push(log);
    }
    return byNode;
  }
}
```

---

## 四、策略专用题型

### 4.1 问题诊断

**v2.4 的 Strategy 节点**：

```typescript
{
  id: 'pythagoras_strategy_001',
  description: '判断是否应该使用勾股定理',
  ...
}
```

**问题**：没有专门题型来观测这个能力

现有题目：
```
求直角三角形斜边 → 测的是 computation，不是 strategy
```

---

### 4.2 解决方案：策略专用题型

#### 第一步：扩展答题模式

```typescript
// ============================================================
// 答题模式（扩展）
// ============================================================
enum AnswerMode {
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  NUMBER = 'number',
  EXPRESSION = 'expression',

  // ✅ 新增：策略选择
  STRATEGY_SELECTION = 'strategy_selection',
}

// 策略选择题的特殊结构
interface StrategySelectionQuestion extends SubQuestion {
  type: AnswerMode.STRATEGY_SELECTION;

  // 策略选项
  strategies: StrategyOption[];
}

interface StrategyOption {
  strategyId: string;      // 如 'pythagoras', 'similar_triangles'
  name: string;            // '勾股定理', '相似三角形'
  description: string;     // '适用于直角三角形边长关系'
  isCorrect: boolean;      // 是否正确答案
}
```

#### 第二步：策略题型示例

```typescript
// ============================================================
// 勾股定理策略题示例
// ============================================================
const PYTHAGORAS_STRATEGY_QUESTION: StrategySelectionQuestion = {
  questionId: 'pyth_strategy_001',
  type: AnswerMode.STRATEGY_SELECTION,
  description: '梯子靠墙，梯子长5米，底部离墙3米，求顶部离地多高。哪种方法最适合？',
  hint: '考虑图形形状和已知条件',

  strategies: [
    {
      strategyId: 'pythagoras',
      name: '勾股定理',
      description: '直角三角形边长关系',
      isCorrect: true,
    },
    {
      strategyId: 'similar_triangles',
      name: '相似三角形',
      description: '对应边成比例',
      isCorrect: false,
    },
    {
      strategyId: 'area_method',
      name: '面积法',
      description: '利用面积关系',
      isCorrect: false,
    },
    {
      strategyId: 'trigonometric',
      name: '三角函数',
      description: '利用正弦余弦',
      isCorrect: false,
    },
  ],

  // 绑定到策略节点
  nodeContributions: [
    {
      nodeId: 'pythagoras_strategy_001',
      level: ContributionLevel.HIGH,
      required: true,
    },
  ],

  expectedAnswer: {
    type: 'strategy_selection',
    value: 'pythagoras',  // 正确答案
  },

  difficulty: 2,
  discrimination: 0.7,
};
```

#### 第三步：策略题的判断逻辑

```typescript
// ============================================================
// 策略题判断器
// ============================================================
function judgeStrategyQuestion(
  question: StrategySelectionQuestion,
  answer: string
): { isCorrect: boolean; selectedStrategy: string } {
  const selected = question.strategies.find(s => s.strategyId === answer);

  if (!selected) {
    return { isCorrect: false, selectedStrategy: answer };
  }

  return {
    isCorrect: selected.isCorrect,
    selectedStrategy: answer,
  };
}

// 在归因中使用
function attributeStrategyResult(
  question: StrategySelectionQuestion,
  result: { isCorrect: boolean; selectedStrategy: string },
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  irtLogger?: IRTLogger
): AttributedResult {
  // 如果选错了策略
  if (!result.isCorrect) {
    // 记录错误模式：策略选择错误
    const strategyNodeId = question.nodeContributions[0].nodeId;
    const mastery = nodeMasteries.get(strategyNodeId);

    if (mastery && irtLogger) {
      // 特殊日志：策略错误
      irtLogger.log({
        timestamp: Date.now(),
        nodeId: strategyNodeId,
        questionId: question.questionId,
        studentId: 'student',
        predictedMastery: mastery.decayedLevel,
        actualCorrect: false,

        // 策略题特殊字段
        baseScore: 0,
        weight: 1,
        penalty: 1,
        predictedBeforePenalty: 0,
        predictedAfterPenalty: 0,

        questionDiscrimination: question.discrimination,
        nodeImportance: nodeRegistry.get(strategyNodeId)!.importance,

        baseError: 1,
        penaltyError: 0,
        weightError: 0,

        contributionLevel: question.nodeContributions[0].level,
        dependencyPrereqScores: new Map(),

        // ✅ 策略题额外信息
        selectedStrategy: result.selectedStrategy,
        correctStrategy: question.strategies.find(s => s.isCorrect)!.strategyId,
      } as any);
    }
  }

  // 正常归因流程...
  return attributeResult(
    question as SubQuestion,
    { isCorrect: result.isCorrect, duration: 0, skipped: false, timestamp: Date.now() },
    nodeMasteries,
    nodeRegistry,
    irtLogger
  );
}
```

---

## 五、Pattern 阈值修正

### 5.1 问题诊断

**v2.4 的 Pattern**：

```typescript
computeAvg - applicationAvg - prereqGap → sigmoid
```

**问题**：高能力学生会被误判

```
computation = 0.95
application = 0.85
gap = 0.05
→ score > 0，误判为"会算不会用"
```

---

### 5.2 解决方案：Pattern gating

```typescript
// ============================================================
// Pattern 检测（带 gating）
// ============================================================
interface PatternMatch {
  pattern: CognitivePattern;
  score: number;
  dependencyGaps?: Map<string, number>;
  rootCause?: string;

  // ✅ 新增：触发条件
  triggerReason: 'weak_threshold' | 'gap_detected' | 'both';
}

function detectPatternsWithGating(
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // ===== Pattern 1: 会算不会用（带 gating） =====
  const computationAvg = averageByType(masteries, NodeType.COMPUTATION);
  const applicationAvg = averageByType(masteries, NodeType.APPLICATION);

  // ✅ Gating 1: 应用必须明显弱
  if (applicationAvg > 0.7) {
    // 应用已经够强，不触发
    // 即使有 gap，也不算"会算不会用"
  } else {
    // ✅ Gating 2: 计算必须明显强
    if (computationAvg > 0.7) {
      // 计算强，应用弱 → 触发
      const applicationNodes = Array.from(nodeRegistry.nodes.values())
        .filter(n => n.type === NodeType.APPLICATION);
      let avgPrereqGap = 0;
      if (applicationNodes.length > 0) {
        const gaps = applicationNodes.map(n =>
          averageDependencyGap(n.id, masteries, nodeRegistry)
        );
        avgPrereqGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      }

      const rawScore = computationAvg - applicationAvg - avgPrereqGap;
      const score = smoothScore(rawScore, 0.3);

      if (score > 0.6) {
        matches.push({
          pattern: {
            patternId: 'compute_but_no_apply',
            name: '会算不会用',
            description: '计算节点掌握，但应用节点薄弱',
            recommendation: '增加应用题练习',
            calculateMatchScore: () => score,
          },
          score,
          dependencyGaps: new Map(),
          rootCause: avgPrereqGap > 0.2 ? '前置薄弱' : '应用不足',
          triggerReason: applicationAvg < 0.5 ? 'weak_threshold' : 'gap_detected',
        });
      }
    }
  }

  // ===== Pattern 2: 识别薄弱（带 gating） =====
  const recognitionAvg = averageByType(masteries, NodeType.RECOGNITION);

  if (recognitionAvg < 0.5) {  // ✅ Gating: 必须明显弱
    matches.push({
      pattern: {
        patternId: 'recognition_weak',
        name: '识别能力薄弱',
        description: '基础识别节点未掌握',
        recommendation: '巩固基础概念',
        calculateMatchScore: () => 1 - recognitionAvg,
      },
      score: 1 - recognitionAvg,
      triggerReason: 'weak_threshold',
    });
  }

  // ===== Pattern 3: 策略薄弱（带 gating） =====
  const strategyAvg = averageByTemplate(
    masteries,
    NodeTemplate.STRATEGY_SELECTION,
    nodeRegistry
  );

  if (strategyAvg < 0.5 && computationAvg > 0.7) {  // ✅ 双重 gating
    matches.push({
      pattern: {
        patternId: 'strategy_weak',
        name: '策略选择薄弱',
        description: '会计算，但不知道什么时候用',
        recommendation: '练习判断题目类型',
        calculateMatchScore: () => 1 - strategyAvg,
      },
      score: 1 - strategyAvg,
      triggerReason: 'weak_threshold',
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}
```

---

## 六、完整数据结构（v2.5）

```typescript
// ============================================================
// 1. 答题模式（扩展）
// ============================================================
enum AnswerMode {
  MULTIPLE_CHOICE = 'multiple_choice',
  YES_NO = 'yes_no',
  NUMBER = 'number',
  EXPRESSION = 'expression',
  STRATEGY_SELECTION = 'strategy_selection',  // ✅ 新增
}

// ============================================================
// 2. 节点模板
// ============================================================
enum NodeTemplate {
  COMPUTATION_SINGLE = 'computation_single',
  RECOGNITION_BINARY = 'recognition_binary',
  CONCEPT_DEFINITION = 'concept_definition',
  APPLICATION_MODELING = 'application_modeling',
  STRATEGY_SELECTION = 'strategy_selection',
}

// ============================================================
// 3. 离散贡献等级
// ============================================================
enum ContributionLevel {
  LOW = 0.2,
  MEDIUM = 0.5,
  HIGH = 1.0
}

// ============================================================
// 4. 错误类型
// ============================================================
enum ErrorType {
  CALCULATION = 'calculation',
  MODELING = 'modeling',
  MISUNDERSTANDING = 'misunderstanding',
  CARELESS = 'careless',
  STRATEGY_ERROR = 'strategy_error',  // ✅ 新增
}

// ============================================================
// 5. 认知节点
// ============================================================
interface CognitiveNode {
  id: string;
  template: NodeTemplate;
  knowledgeUnit: string;
  chapter: string;
  type: NodeType;
  description: string;
  difficulty: number;
  importance: number;
  dependencies: {
    prerequisiteId: string;
    strength: 'strong' | 'weak';
  }[];
  decayRate: number;
  examples?: string[];
  commonMistakes?: ErrorType[];
}

// ============================================================
// 6. 策略选项（新增）
// ============================================================
interface StrategyOption {
  strategyId: string;
  name: string;
  description: string;
  isCorrect: boolean;
}

// ============================================================
// 7. 子问题（扩展）
// ============================================================
interface SubQuestion {
  questionId: string;
  type: AnswerMode;
  description: string;
  hint?: string;
  expectedAnswer: ExpectedAnswer;
  dependsOn?: string[];
  nodeContributions: NodeContribution[];
  difficulty: number;
  discrimination: number;

  // 策略题专用（可选）
  strategies?: StrategyOption[];
}

// ============================================================
// 8. IRT 训练日志（可分解版）
// ============================================================
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;
  studentId: string;
  predictedMastery: number;
  actualCorrect: boolean;

  // 可分解项
  baseScore: number;
  weight: number;
  penalty: number;
  predictedBeforePenalty: number;
  predictedAfterPenalty: number;

  // 参数上下文
  questionDiscrimination: number;
  nodeImportance: number;

  // 误差分解
  baseError: number;
  penaltyError: number;
  weightError: number;

  // 原始数据
  contributionLevel: ContributionLevel;
  dependencyPrereqScores: Map<string, number>;
}

// ============================================================
// 9. 参数校准（分层版）
// ============================================================
interface ParameterCalibration {
  nodeId: string;
  importanceCorrection: number;
  discriminationCorrection: number;
  penaltyCorrection: number;
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
// 10. Pattern 匹配（带 gating）
// ============================================================
interface PatternMatch {
  pattern: CognitivePattern;
  score: number;
  dependencyGaps?: Map<string, number>;
  rootCause?: string;
  triggerReason: 'weak_threshold' | 'gap_detected' | 'both';  // ✅ 新增
}
```

---

## 七、Phase 0 可运行验证

详见独立文件：`validation/phase0-simulation.ts`

**验证目标**：

```typescript
interface Phase0Result {
  passed: boolean;
  monotonicityScore: number;
  predictionAccuracy: number;
  convergenceRate: number;
  calibrationQuality: number;
  details: {
    bucketCorrectRates: number[];
    predictions: { predicted: boolean; actual: boolean }[];
  };
}

// 判断标准
isPhase0Passed(result: Phase0Result): boolean {
  return (
    result.monotonicityScore > 0.8 &&
    result.predictionAccuracy > 0.65 &&
    result.convergenceRate < 10 &&
    result.calibrationQuality > 0.7
  );
}
```

---

## 八、参数默认值（v2.5）

```typescript
// ===== 离散权重 =====
const CONTRIBUTION_WEIGHTS = {
  LOW: 0.2,
  MEDIUM: 0.5,
  HIGH: 1.0,
};

// ===== 依赖惩罚（单层，可校准） =====
const DEPENDENCY_PENALTIES = {
  STRONG: 0.5,
  WEAK: 0.9,
};

// ===== 时间衰减率 =====
const DECAY_RATES = {
  RECOGNITION: 0.03,
  CONCEPT: 0.03,
  COMPUTATION: 0.02,
  APPLICATION: 0.08,
  REASONING: 0.1,
  STRATEGY: 0.05,
};

// ===== 掌握度阈值 =====
const MASTERY_THRESHOLDS = {
  PREREQUISITE: 0.7,
  MASTERED: 0.8,
  CONFIDENCE_HIGH: 0.7,
};

// ===== Pattern gating =====
const PATTERN_GATING = {
  APPLICATION_WEAK_THRESHOLD: 0.7,   // 应用 < 0.7 才触发
  COMPUTATION_STRONG_THRESHOLD: 0.7, // 计算 > 0.7 才触发
  RECOGNITION_WEAK_THRESHOLD: 0.5,   // 识别 < 0.5 才触发
  STRATEGY_WEAK_THRESHOLD: 0.5,       // 策略 < 0.5 才触发
};

// ===== IRT 校准 =====
const CALIBRATION_CONFIG = {
  MIN_SAMPLE_SIZE: 10,
  WEEKLY_INTERVAL: 7 * 24 * 60 * 60 * 1000,
  MAX_CORRECTION: 0.5,
  SINGLE_PARAM_CONSTRAINT: true,  // ✅ 单参数约束
};

// ===== Phase 0 验证 =====
const LOOP_VALIDATION = {
  BUCKET_COUNT: 10,
  MIN_MONOTONICITY: 0.8,
  MIN_PREDICTION_ACCURACY: 0.65,
  MAX_CONVERGENCE_QUESTIONS: 10,
  MIN_CALIBRATION_QUALITY: 0.7,
};
```

---

## 九、版本变更记录

### v2.5 主要变更（可识别系统）

| 变更 | 说明 | 原因 |
|------|------|------|
| **可分解日志** | 拆解 base/weight/penalty | 参数可识别 |
| **误差分解** | baseError/penaltyError/weightError | 误差可归因 |
| **日志分析器** | LogAnalyzer | 判断主要误差来源 |
| **分层校准** | 三层归因逻辑 | 精准校准 |
| **单参数约束** | 每轮只调一个参数 | 防止震荡 |
| **策略题型** | STRATEGY_SELECTION + StrategyOption | strategy 可观测 |
| **Pattern gating** | 阈值约束 | 避免高能力误判 |

### v2.4 → v2.5 差异

| 模块 | v2.4 | v2.5 |
|------|------|------|
| 日志 | 整体误差 | 分解误差 |
| 校准 | 整体修正 | 分层+单参数 |
| 策略 | 无题型 | 专用题型 |
| Pattern | 无阈值 | 带 gating |

---

**文档版本**: v2.5（可识别系统）
**最后更新**: 2026-04-26
**状态**: 可收敛规格
**下一步**: 运行 Phase 0 simulation（validation/phase0-simulation.ts）
