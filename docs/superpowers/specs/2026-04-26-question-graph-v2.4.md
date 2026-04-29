# Question Graph 架构设计文档 v2.4（可验证版）

**日期**: 2026-04-26
**状态**: 工程规格 + 最小闭环验证
**作者**: AI + 用户头脑风暴 + 架构评审 + 工程化收敛 + 系统化修正

---

## v2.4 核心修正

> **v2.4 目标：解决3个致命隐蔽坑，确保系统真的能收敛。**

本版本基于 v2.3，修正3个关键问题：
1. **弱IRT问题** → 加参数学习钩子，让权重可学习
2. **伪节点问题** → 加 Strategy 节点，覆盖决策层
3. **Pattern假聪明** → 引入依赖结构，避免误判

---

## 目录

- [一、v2.4 变更说明](#一v24-变更说明)
- [二、弱IRT问题与参数学习](#二弱irt问题与参数学习)
- [三、Strategy 节点](#三strategy-节点)
- [四、Pattern 依赖结构修正](#四pattern-依赖结构修正)
- [五、最小闭环验证](#五最小闭环验证)
- [六、完整数据结构](#六完整数据结构)
- [七、实施路线图（修正版）](#七实施路线图修正版)

---

## 一、v2.4 变更说明

### 1.1 三大修正

| # | 问题 | v2.3 | v2.4 |
|---|------|------|------|
| 1 | 弱IRT | 拍脑袋参数 | **参数学习钩子** |
| 2 | 伪节点 | 无策略层 | **STRATEGY_SELECTION** |
| 3 | Pattern假聪明 | 只看结果 | **引入依赖结构** |

### 1.2 设计哲学

> **一个系统如果不收敛，再优雅的架构都是空架子。**

v2.4 的核心原则：
1. **所有参数必须可校准**
2. **所有认知层次必须覆盖**
3. **所有诊断必须考虑因果**

---

## 二、弱IRT问题与参数学习

### 2.1 问题诊断

**v2.3 的核心公式**：

```typescript
// ❌ 问题：参数都是拍脑袋的
weight = importance × discrimination × level
gain = importance × uncertainty

// importance: 人工设 0.8
// discrimination: 人工设 0.8
// level: 人工选 HIGH/MEDIUM/LOW
```

**IRT 的本质**：

```typescript
// ✅ 真IRT：参数是从数据学出来的
P(correct) = f(ability - difficulty)
discrimination = 统计估计（不是人工设）
```

**后果**：

> 系统看起来在算，但不收敛。不同出题人 → 诊断不一致。

---

### 2.2 解决方案：参数学习钩子

#### 第一步：添加日志接口

```typescript
// ============================================================
// IRT 训练日志（新增）
// ============================================================
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;

  // 预测 vs 实际
  predictedMastery: number;      // 系统预测的掌握度
  actualCorrect: boolean;         // 实际答题结果

  // 上下文
  studentId: string;
  questionDiscrimination: number;
  nodeImportance: number;

  // 用于后续校准
  calibrationError: number;      // 预测误差
}

interface IRTLogger {
  log(event: IRTTrainingLog): void;
  getLogs(nodeId?: string): IRTTrainingLog[];
  exportCalibrationData(): IRTTrainingLog[];
}

class SimpleIRTLogger implements IRTLogger {
  private logs: IRTTrainingLog[] = [];

  log(event: IRTTrainingLog): void {
    this.logs.push(event);

    // 可选：实时写入外部存储
    if (this.logs.length % 100 === 0) {
      this.flushToStorage();
    }
  }

  getLogs(nodeId?: string): IRTTrainingLog[] {
    if (nodeId) {
      return this.logs.filter(l => l.nodeId === nodeId);
    }
    return [...this.logs];
  }

  exportCalibrationData(): IRTTrainingLog[] {
    return [...this.logs];
  }

  private flushToStorage(): void {
    // TODO: 写入文件 / 数据库
  }
}
```

#### 第二步：在归因计算中加入日志钩子

```typescript
// ============================================================
// 归因计算（带学习钩子）
// ============================================================
function attributeResult(
  question: SubQuestion,
  result: QuestionResult,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry,
  irtLogger?: IRTLogger  // ✅ 新增：可选的日志钩子
): AttributedResult {
  const attributions = new Map<string, NodeAttribution>();
  const weights = normalizeWeights(question.nodeContributions, nodeRegistry, question);

  for (const contrib of question.nodeContributions) {
    const node = nodeRegistry.get(contrib.nodeId)!;
    const weight = weights.get(contrib.nodeId)!;
    const mastery = nodeMasteries.get(contrib.nodeId);

    // 基础得分
    let baseScore = result.isCorrect ? 1.0 : 0.0;
    baseScore *= question.discrimination;

    // 依赖惩罚
    const penalty = calculateDependencyPenalty(contrib.nodeId, nodeMasteries, nodeRegistry);
    const effectiveScore = baseScore * penalty * weight;

    // 置信度更新
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

    // ✅ 新增：IRT 学习钩子
    if (irtLogger && mastery) {
      irtLogger.log({
        timestamp: Date.now(),
        nodeId: contrib.nodeId,
        questionId: question.questionId,
        predictedMastery: mastery.decayedLevel,
        actualCorrect: result.isCorrect,
        studentId: 'student',  // 从上下文获取
        questionDiscrimination: question.discrimination,
        nodeImportance: node.importance,
        calibrationError: Math.abs(mastery.decayedLevel - (result.isCorrect ? 1 : 0)),
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

#### 第三步：参数校准机制

```typescript
// ============================================================
// 参数校准器（新增）
// ============================================================
interface ParameterCalibration {
  nodeId: string;
  importanceCorrection: number;    // 重要性修正系数
  discriminationCorrection: number; // 区分度修正系数

  // 统计信息
  sampleSize: number;
  lastCalibrated: number;
}

class ParameterCalibrator {
  private calibrations: Map<string, ParameterCalibration> = new Map();

  // 每周运行一次
  calibrate(
    logs: IRTTrainingLog[],
    nodeRegistry: CognitiveNodeRegistry
  ): Map<string, ParameterCalibration> {
    // 按节点分组
    const byNode = new Map<string, IRTTrainingLog[]>();
    for (const log of logs) {
      if (!byNode.has(log.nodeId)) {
        byNode.set(log.nodeId, []);
      }
      byNode.get(log.nodeId)!.push(log);
    }

    // 对每个节点进行简单回归
    for (const [nodeId, nodeLogs] of byNode) {
      if (nodeLogs.length < 10) continue;  // 样本太少跳过

      const calibration = this.calibrateNode(nodeId, nodeLogs);
      this.calibrations.set(nodeId, calibration);

      // 应用修正到节点注册表
      this.applyCalibration(nodeId, calibration, nodeRegistry);
    }

    return this.calibrations;
  }

  private calibrateNode(
    nodeId: string,
    logs: IRTTrainingLog[]
  ): ParameterCalibration {
    // 简单线性回归：actualCorrect ~ predictedMastery
    // 计算预测误差的均值

    let sumError = 0;
    let sumPredicted = 0;

    for (const log of logs) {
      const predicted = log.predictedMastery;
      const actual = log.actualCorrect ? 1 : 0;
      sumError += (actual - predicted);
      sumPredicted += predicted;
    }

    const avgPredicted = sumPredicted / logs.length;
    const avgError = sumError / logs.length;

    // 修正系数：如果系统普遍高估，降低 importance
    const importanceCorrection = 1 - avgError * 0.1;  // 保守修正

    return {
      nodeId,
      importanceCorrection: Math.max(0.5, Math.min(1.5, importanceCorrection)),
      discriminationCorrection: 1.0,  // 暂时不修正区分度
      sampleSize: logs.length,
      lastCalibrated: Date.now(),
    };
  }

  private applyCalibration(
    nodeId: string,
    calibration: ParameterCalibration,
    nodeRegistry: CognitiveNodeRegistry
  ): void {
    const node = nodeRegistry.get(nodeId);
    if (!node) return;

    // 应用修正（保留原始值，使用修正后的值）
    node.importance *= calibration.importanceCorrection;

    // 确保在合理范围内
    node.importance = Math.max(0.1, Math.min(1.0, node.importance));
  }

  getCalibration(nodeId: string): ParameterCalibration | undefined {
    return this.calibrations.get(nodeId);
  }
}
```

#### 第四步：集成到学生状态

```typescript
interface StudentState {
  nodeMasteries: Map<string, NodeMastery>;
  questionResults: Map<string, QuestionResult>;
  recommendedPath: string[];
  patternMatches: PatternMatch[];

  // ✅ 新增：IRT 日志和校准
  irtLogger: IRTLogger;
  calibrationHistory: Map<string, ParameterCalibration>;
}

// 创建学生状态时初始化
function createStudentState(): StudentState {
  return {
    nodeMasteries: new Map(),
    questionResults: new Map(),
    recommendedPath: [],
    patternMatches: [],
    irtLogger: new SimpleIRTLogger(),
    calibrationHistory: new Map(),
  };
}
```

---

### 2.3 校准周期

```typescript
// ============================================================
// 定期校准任务
// ============================================================
class WeeklyCalibrationTask {
  private calibrator: ParameterCalibrator;
  private nodeRegistry: CognitiveNodeRegistry;

  async run(studentStates: StudentState[]): Promise<void> {
    // 收集所有学生的日志
    const allLogs: IRTTrainingLog[] = [];
    for (const state of studentStates) {
      allLogs.push(...state.irtLogger.exportCalibrationData());
    }

    // 运行校准
    const calibrations = this.calibrator.calibrate(allLogs, this.nodeRegistry);

    // 记录校准历史
    console.log(`Calibrated ${calibrations.size} nodes`);
    for (const [nodeId, cal] of calibrations) {
      console.log(`  ${nodeId}: importance × ${cal.importanceCorrection.toFixed(3)}`);
    }
  }
}
```

---

## 三、Strategy 节点

### 3.1 问题诊断

**v2.3 的节点层次**：

```
识别 → 概念 → 计算 → 应用
```

**缺失的层次**：

> 学生"会算"但"不会用"，往往不是计算问题，而是：
>
> ❌ **不知道什么时候该用勾股定理**

这是一个 **决策层 / 策略层** 能力，不在现有节点中。

---

### 3.2 解决方案：STRATEGY_SELECTION 节点

#### 第一步：扩展节点模板

```typescript
// ============================================================
// 节点模板（扩展版）
// ============================================================
enum NodeTemplate {
  COMPUTATION_SINGLE = 'computation_single',
  RECOGNITION_BINARY = 'recognition_binary',
  CONCEPT_DEFINITION = 'concept_definition',
  APPLICATION_MODELING = 'application_modeling',

  // ✅ 新增：策略选择
  STRATEGY_SELECTION = 'strategy_selection',
}
```

#### 第二步：Strategy 节点定义

```typescript
interface CognitiveNode {
  id: string;
  template: NodeTemplate;
  knowledgeUnit: string;
  chapter: string;
  type: NodeType;
  description: string;
  difficulty: number;
  importance: number;
  dependencies: { prerequisiteId: string; strength: 'strong' | 'weak'; }[];
  decayRate: number;
  examples?: string[];
  commonMistakes?: ErrorType[];
}

// Strategy 节点示例
const STRATEGY_NODE_EXAMPLE: CognitiveNode = {
  id: 'pythagoras_strategy_001',
  template: NodeTemplate.STRATEGY_SELECTION,  // ✅ 新模板
  knowledgeUnit: 'pythagoras',
  chapter: 'chapter17',
  type: NodeType.REASONING,  // 策略属于推理类
  description: '判断是否应该使用勾股定理',
  difficulty: 0.6,
  importance: 0.9,  // 策略层很重要
  dependencies: [
    { prerequisiteId: 'pythagoras_recognition_001', strength: 'strong' }
  ],
  decayRate: 0.05,  // 介于概念和应用之间
  examples: [
    '判断题目是否涉及直角三角形边长关系',
    '判断是否需要求斜边或直角边'
  ],
  commonMistakes: [ErrorType.MISUNDERSTANDING, ErrorType.MODELING],
};
```

#### 第三步：更新 NodeFactory

```typescript
class NodeFactory {
  // ... 现有方法 ...

  // ✅ 新增：创建策略节点
  private createStrategyNode(unit: KnowledgeUnit): CognitiveNode {
    return {
      id: `${unit.id}_strategy_001`,
      template: NodeTemplate.STRATEGY_SELECTION,
      knowledgeUnit: unit.id,
      chapter: unit.chapter,
      type: NodeType.REASONING,
      description: `判断是否应该使用${unit.name}`,
      difficulty: 0.6,
      importance: 0.9,
      dependencies: [
        { prerequisiteId: `${unit.id}_recognition_001`, strength: 'strong' }
      ],
      decayRate: 0.05,
      examples: [
        `判断题目是否适合用${unit.name}解决`,
        `识别${unit.name}的适用场景`
      ],
      commonMistakes: [ErrorType.MISUNDERSTANDING, ErrorType.MODELING],
    };
  }

  // 更新生成方法
  generateForKnowledgeUnit(unit: KnowledgeUnit): CognitiveNode[] {
    const nodes: CognitiveNode[] = [];

    // 1. 识别节点
    nodes.push(this.createRecognitionNode(unit));

    // 2. 概念节点
    nodes.push(...this.createConceptNodes(unit));

    // 3. ✅ 策略节点（新增，在计算之前）
    nodes.push(this.createStrategyNode(unit));

    // 4. 计算节点
    const formulaCount = this.countFormulas(unit);
    for (let i = 0; i < formulaCount; i++) {
      nodes.push(this.createComputationNode(unit, i));
    }

    // 5. 应用节点
    nodes.push(...this.createApplicationNodes(unit));

    nodes.forEach(n => this.registry.register(n));
    return nodes;
  }
}
```

#### 第四步：完整的节点层次

```
v2.3:  识别 → 概念 → 计算 → 应用
v2.4:  识别 → 概念 → 策略 → 计算 → 应用
                      ↑
                   新增层
```

---

## 四、Pattern 依赖结构修正

### 4.1 问题诊断

**v2.3 的 Pattern**：

```typescript
// ❌ 只看结果，不看因果
computeAvg - applicationAvg → sigmoid

// 问题：如果两个都低，会误判为"会算不会用"
// 实际可能是：根本不会算
```

**真实情况**：

```
学生 A: computation=0.8, application=0.3
→ 真的"会算不会用" ✅

学生 B: computation=0.3, application=0.2
→ 不是"会算不会用"，是"都不会" ❌
  但 v2.3 会误判
```

---

### 4.2 解决方案：引入依赖结构

#### 第一步：计算依赖缺口

```typescript
// ============================================================
// 依赖缺口计算（新增）
// ============================================================
interface DependencyGap {
  nodeId: string;
  gap: number;  // 0-1，前置节点的掌握度缺口
}

function calculateDependencyGaps(
  nodeId: string,
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): Map<string, number> {
  const node = nodeRegistry.get(nodeId)!;
  const gaps = new Map<string, number>();

  for (const dep of node.dependencies) {
    const prereqMastery = masteries.get(dep.prerequisiteId);
    if (!prereqMastery) {
      gaps.set(dep.prerequisiteId, 1.0);  // 完全缺口
    } else {
      const gap = Math.max(0, 0.8 - prereqMastery.decayedLevel);
      gaps.set(dep.prerequisiteId, gap);
    }
  }

  return gaps;
}

function averageDependencyGap(
  nodeId: string,
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const gaps = calculateDependencyGaps(nodeId, masteries, nodeRegistry);
  if (gaps.size === 0) return 0;

  const sum = Array.from(gaps.values()).reduce((a, b) => a + b, 0);
  return sum / gaps.size;
}
```

#### 第二步：修正 Pattern 匹配

```typescript
// ============================================================
// Pattern 检测（修正版）
// ============================================================
function detectPatterns(
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry  // ✅ 新增参数
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // ===== Pattern 1: 会算不会用（修正版） =====
  const computationAvg = averageByType(masteries, NodeType.COMPUTATION);
  const applicationAvg = averageByType(masteries, NodeType.APPLICATION);

  // ✅ 找到典型的应用节点（用于计算依赖缺口）
  const applicationNodes = Array.from(nodeRegistry.nodes.values())
    .filter(n => n.type === NodeType.APPLICATION);

  let avgPrereqGap = 0;
  if (applicationNodes.length > 0) {
    const gaps = applicationNodes.map(n =>
      averageDependencyGap(n.id, masteries, nodeRegistry)
    );
    avgPrereqGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  // ✅ 修正公式：扣除前置缺口
  const computeButNoApplyScore = smoothScore(
    (computationAvg - applicationAvg) - avgPrereqGap,
    0.3
  );

  if (computeButNoApplyScore > 0.6) {
    matches.push({
      pattern: {
        patternId: 'compute_but_no_apply',
        name: '会算不会用',
        description: '计算节点掌握，但应用节点薄弱（已排除前置影响）',
        recommendation: '增加应用题练习，将计算能力迁移到实际问题',
        calculateMatchScore: (m) => computeButNoApplyScore,
      },
      score: computeButNoApplyScore,
    });
  }

  // ===== Pattern 2: 识别薄弱 =====
  const recognitionAvg = averageByType(masteries, NodeType.RECOGNITION);
  const recognitionWeakScore = 1 - recognitionAvg;

  if (recognitionWeakScore > 0.6) {
    matches.push({
      pattern: {
        patternId: 'recognition_weak',
        name: '识别能力薄弱',
        description: '基础识别节点未掌握',
        recommendation: '巩固基础概念，多做识别类题目',
        calculateMatchScore: (m) => recognitionWeakScore,
      },
      score: recognitionWeakScore,
    });
  }

  // ===== Pattern 3: 策略薄弱（新增） =====
  const strategyAvg = averageByTemplate(masteries, NodeTemplate.STRATEGY_SELECTION, nodeRegistry);
  const strategyWeakScore = 1 - strategyAvg;

  if (strategyWeakScore > 0.6 && computationAvg > 0.7) {
    matches.push({
      pattern: {
        patternId: 'strategy_weak',
        name: '策略选择薄弱',
        description: '会计算，但不知道什么时候用',
        recommendation: '练习判断题目类型，选择合适的解题方法',
        calculateMatchScore: (m) => strategyWeakScore,
      },
      score: strategyWeakScore,
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ✅ 新增：按模板平均
function averageByTemplate(
  masteries: Map<string, NodeMastery>,
  template: NodeTemplate,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const nodes = Array.from(nodeRegistry.nodes.values())
    .filter(n => n.template === template);

  if (nodes.length === 0) return 0.5;

  const values = nodes.map(n => {
    const mastery = masteries.get(n.id);
    return mastery ? mastery.decayedLevel : 0.5;
  });

  return values.reduce((a, b) => a + b, 0) / values.length;
}
```

#### 第三步：诊断结果包含依赖信息

```typescript
interface PatternMatch {
  pattern: CognitivePattern;
  score: number;

  // ✅ 新增：依赖信息
  dependencyGaps?: Map<string, number>;
  rootCause?: string;  // 根本原因分析
}

// 在 detectPatterns 中填充
function detectPatternsWithRootCause(
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): PatternMatch[] {
  const matches = detectPatterns(masteries, nodeRegistry);

  // 为每个匹配添加根本原因分析
  for (const match of matches) {
    if (match.pattern.patternId === 'compute_but_no_apply') {
      // 检查是否真的是策略问题
      const strategyAvg = averageByTemplate(
        masteries,
        NodeTemplate.STRATEGY_SELECTION,
        nodeRegistry
      );

      if (strategyAvg < 0.5) {
        match.rootCause = '策略选择薄弱，不知道何时应用';
      } else {
        match.rootCause = '应用练习不足';
      }
    }
  }

  return matches;
}
```

---

## 五、最小闭环验证

### 5.1 验证设计

**目标**：证明系统能收敛，而不是"看起来对"

**设计**：

```
知识点: 勾股定理
节点: 5个（识别、概念、策略、计算、应用）
题目: 20道
学生: 10个（或模拟）
```

---

### 5.2 核心指标

```typescript
// ============================================================
// 闭环验证指标
// ============================================================
interface LoopValidationMetrics {
  // 主指标：单调性
  monotonicityScore: number;  // P(correct|mastery) 是否单调递增

  // 辅助指标
  predictionAccuracy: number;  // 用 mastery 预测答题的准确率
  calibrationError: number;    // 预测 vs 实际的误差
  convergenceRate: number;     // 多少题后 mastery 稳定
}

function validateLoop(
  simulationResults: SimulationResult[]
): LoopValidationMetrics {
  // 1. 按 mastery 分桶
  const buckets = groupByMasteryLevel(simulationResults, 10);

  // 2. 计算每桶的正确率
  const correctRates = buckets.map(bucket =>
    bucket.filter(r => r.correct).length / bucket.length
  );

  // 3. 检查单调性
  let monotonicCount = 0;
  for (let i = 1; i < correctRates.length; i++) {
    if (correctRates[i] >= correctRates[i - 1]) {
      monotonicCount++;
    }
  }
  const monotonicityScore = monotonicCount / (correctRates.length - 1);

  // 4. 预测准确率
  let correctPredictions = 0;
  for (const result of simulationResults) {
    const predicted = result.predictedMastery > 0.5;
    const actual = result.correct;
    if (predicted === actual) correctPredictions++;
  }
  const predictionAccuracy = correctPredictions / simulationResults.length;

  return {
    monotonicityScore,
    predictionAccuracy,
    calibrationError: 1 - predictionAccuracy,
    convergenceRate: calculateConvergence(simulationResults),
  };
}

// 判断标准
function isSystemValid(metrics: LoopValidationMetrics): boolean {
  return (
    metrics.monotonicityScore > 0.8 &&  // 80% 的桶是单调的
    metrics.predictionAccuracy > 0.65 && // 预测准确率 > 65%
    metrics.convergenceRate < 10         // 10题内收敛
  );
}
```

---

### 5.3 模拟实验

```typescript
// ============================================================
// 最小闭环模拟
// ============================================================
interface SimulationConfig {
  knowledgeUnit: string;
  nodeCount: number;
  questionCount: number;
  studentCount: number;
}

interface SimulationResult {
  studentId: string;
  questionId: string;
  nodeId: string;
  predictedMastery: number;
  correct: boolean;
}

async function runMinimumLoopSimulation(
  config: SimulationConfig
): Promise<LoopValidationMetrics> {
  // 1. 初始化
  const registry = new CognitiveNodeRegistry();
  const factory = new NodeFactory(registry, mockTextbook);
  const unit: KnowledgeUnit = { id: config.knowledgeUnit, name: '勾股定理', chapter: 'ch17', complexity: 'medium' };

  // 2. 生成节点
  const nodes = factory.generateForKnowledgeUnit(unit);
  console.log(`Generated ${nodes.length} nodes`);

  // 3. 生成题目
  const questions = generateQuestions(nodes, config.questionCount);

  // 4. 模拟学生
  const results: SimulationResult[] = [];
  for (let i = 0; i < config.studentCount; i++) {
    const student = createSimulatedStudent(nodes);
    const studentResults = await simulateStudentPractice(student, questions, registry);
    results.push(...studentResults);
  }

  // 5. 验证
  const metrics = validateLoop(results);

  console.log('=== Loop Validation Results ===');
  console.log(`Monotonicity: ${metrics.monotonicityScore.toFixed(3)}`);
  console.log(`Prediction Accuracy: ${metrics.predictionAccuracy.toFixed(3)}`);
  console.log(`Convergence Rate: ${metrics.convergenceRate.toFixed(1)} questions`);
  console.log(`Valid: ${isSystemValid(metrics) ? 'YES ✅' : 'NO ❌'}`);

  return metrics;
}

// 模拟学生练习
async function simulateStudentPractice(
  student: SimulatedStudent,
  questions: SubQuestion[],
  registry: CognitiveNodeRegistry
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];
  let state = createStudentState();

  for (const question of questions) {
    // 预测
    const predictedMastery = predictMastery(state, question, registry);

    // 答题（模拟）
    const correct = student.answer(question, state);

    // 更新
    const result: QuestionResult = {
      questionId: question.questionId,
      isCorrect: correct,
      duration: 1000,
      skipped: false,
      timestamp: Date.now(),
    };

    const attributed = attributeResult(question, result, state.nodeMasteries, registry, state.irtLogger);
    state = updateNodeMasteries([attributed], state.nodeMasteries, registry);

    results.push({
      studentId: student.id,
      questionId: question.questionId,
      nodeId: question.nodeContributions[0].nodeId,
      predictedMastery,
      correct,
    });
  }

  return results;
}
```

---

## 六、完整数据结构（v2.4）

```typescript
// ============================================================
// 1. 节点模板（扩展）
// ============================================================
enum NodeTemplate {
  COMPUTATION_SINGLE = 'computation_single',
  RECOGNITION_BINARY = 'recognition_binary',
  CONCEPT_DEFINITION = 'concept_definition',
  APPLICATION_MODELING = 'application_modeling',
  STRATEGY_SELECTION = 'strategy_selection',  // ✅ 新增
}

// ============================================================
// 2. 离散贡献等级
// ============================================================
enum ContributionLevel {
  LOW = 0.2,
  MEDIUM = 0.5,
  HIGH = 1.0
}

// ============================================================
// 3. 错误类型
// ============================================================
enum ErrorType {
  CALCULATION = 'calculation',
  MODELING = 'modeling',
  MISUNDERSTANDING = 'misunderstanding',
  CARELESS = 'careless',
}

// ============================================================
// 4. 认知节点
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

enum NodeType {
  RECOGNITION = 'recognition',
  CONCEPT = 'concept',
  COMPUTATION = 'computation',
  APPLICATION = 'application',
  REASONING = 'reasoning',
}

// ============================================================
// 5. 节点贡献度
// ============================================================
interface NodeContribution {
  nodeId: string;
  level: ContributionLevel;
  required: boolean;
}

// ============================================================
// 6. 子问题
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
}

// ============================================================
// 7. 节点掌握度
// ============================================================
interface NodeMastery {
  nodeId: string;
  level: number;
  confidence: number;
  decayedLevel: number;
  errorPatterns: Map<ErrorType, number>;
  recentErrors: {
    errorType: ErrorType;
    questionId: string;
    timestamp: number;
  }[];
  recentAttempts: Attempt[];
  lastAttempt: number;
}

// ============================================================
// 8. IRT 训练日志（新增）
// ============================================================
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;
  predictedMastery: number;
  actualCorrect: boolean;
  studentId: string;
  questionDiscrimination: number;
  nodeImportance: number;
  calibrationError: number;
}

interface IRTLogger {
  log(event: IRTTrainingLog): void;
  getLogs(nodeId?: string): IRTTrainingLog[];
  exportCalibrationData(): IRTTrainingLog[];
}

// ============================================================
// 9. 参数校准（新增）
// ============================================================
interface ParameterCalibration {
  nodeId: string;
  importanceCorrection: number;
  discriminationCorrection: number;
  sampleSize: number;
  lastCalibrated: number;
}

// ============================================================
// 10. Pattern 匹配（修正版）
// ============================================================
interface PatternMatch {
  pattern: CognitivePattern;
  score: number;
  dependencyGaps?: Map<string, number>;  // ✅ 新增
  rootCause?: string;                    // ✅ 新增
}

interface CognitivePattern {
  patternId: string;
  name: string;
  description: string;
  recommendation: string;
  calculateMatchScore(masteries: Map<string, NodeMastery>): number;
}

// ============================================================
// 11. 学生状态（扩展）
// ============================================================
interface StudentState {
  nodeMasteries: Map<string, NodeMastery>;
  questionResults: Map<string, QuestionResult>;
  recommendedPath: string[];
  patternMatches: PatternMatch[];

  // ✅ 新增
  irtLogger: IRTLogger;
  calibrationHistory: Map<string, ParameterCalibration>;
}
```

---

## 七、实施路线图（修正版）

### 7.1 Phase 0: 最小闭环验证（1周，必做）

**在写任何产品代码之前，先验证系统能收敛**

- [ ] 实现模拟器（SimulatedStudent）
- [ ] 生成勾股定理的 5 个节点
- [ ] 生成 20 道题目
- [ ] 跑 10 个模拟学生
- [ ] 验证 `isSystemValid() === true`

**输出**: `validation/loop-simulation.ts`

**如果验证失败**：停止，调整参数，重新验证。

---

### 7.2 Phase 1: 数据结构 + IRT 钩子（4天）

- [ ] 实现完整数据结构（v2.4）
- [ ] 实现 `SimpleIRTLogger`
- [ ] 实现 `ParameterCalibrator`
- [ ] 在 `attributeResult` 中加入日志钩子
- [ ] 单元测试

**输出**: `types/`, `lib/irt/`

---

### 7.3 Phase 2: 节点工厂（含 Strategy）（3天）

- [ ] 扩展 `NodeTemplate` 枚举
- [ ] 实现 `createStrategyNode()`
- [ ] 生成勾股定理的 6 个节点（含策略）
- [ ] 模板校验

**输出**: `lib/node-factory/`

---

### 7.4 Phase 3: Pattern 依赖结构（3天）

- [ ] 实现 `calculateDependencyGaps()`
- [ ] 修正 `detectPatterns()` 引入依赖
- [ ] 实现根本原因分析
- [ ] 单元测试

**输出**: `lib/pattern/`

---

### 7.5 Phase 4: 多节点归因（4天）

- [ ] 实现权重自动计算
- [ ] 实现单层依赖惩罚
- [ ] 实现 `attributeResult()`（含 IRT 钩子）
- [ ] 实现 `updateNodeMasteries()`
- [ ] 集成测试

**输出**: `lib/attribution/`

---

### 7.6 Phase 5: 诊断引擎 + UI（5天）

- [ ] 实现启发式增益（简化版）
- [ ] 实现问题调度器
- [ ] 实现诊断结果展示
- [ ] 实现节点进度可视化
- [ ] E2E 测试

**输出**: `lib/diagnosis/`, `components/Diagnosis/`

---

### 7.7 Phase 6: 参数校准任务（持续）

- [ ] 实现每周校准任务
- [ ] 监控校准效果
- [ ] 调整校准参数

**输出**: `lib/calibration/`

---

## 八、参数默认值（v2.4）

```typescript
// ===== 离散权重 =====
const CONTRIBUTION_WEIGHTS = {
  LOW: 0.2,
  MEDIUM: 0.5,
  HIGH: 1.0,
};

// ===== 依赖惩罚（单层） =====
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
  STRATEGY: 0.05,  // ✅ 新增
};

// ===== 掌握度阈值 =====
const MASTERY_THRESHOLDS = {
  PREREQUISITE: 0.7,
  MASTERED: 0.8,
  CONFIDENCE_HIGH: 0.7,
};

// ===== Pattern 检测 =====
const PATTERN_THRESHOLD = 0.6;

// ===== IRT 校准 =====
const CALIBRATION_CONFIG = {
  MIN_SAMPLE_SIZE: 10,      // 最小样本数
  WEEKLY_INTERVAL: 7 * 24 * 60 * 60 * 1000,  // 每周
  MAX_CORRECTION: 0.5,      // 最大修正幅度
};

// ===== 闭环验证 =====
const LOOP_VALIDATION = {
  BUCKET_COUNT: 10,         // 分桶数
  MIN_MONOTONICITY: 0.8,    // 最小单调性
  MIN_PREDICTION_ACCURACY: 0.65,
  MAX_CONVERGENCE_QUESTIONS: 10,
};
```

---

## 九、成功指标（v2.4）

### 9.1 系统收敛指标（新增）

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 单调性分数 | > 0.8 | P(correct\|mastery) 单调递增的比例 |
| 预测准确率 | > 0.65 | 用 mastery 预测答题 |
| 收敛速度 | < 10 题 | mastery 稳定所需题目数 |

### 9.2 产品指标

| 指标 | 目标 |
|------|------|
| 完成率 | > 85% |
| 平均答题时间 | 减少 20% |
| 学生满意度 | > 4.0/5.0 |

---

## 十、版本变更记录

### v2.4 主要变更（系统化修正）

| 变更 | 说明 | 原因 |
|------|------|------|
| **IRT 学习钩子** | 新增 `IRTTrainingLog` + `IRTLogger` | 让参数可学习，确保收敛 |
| **参数校准器** | 新增 `ParameterCalibrator` | 每周自动校准 importance |
| **Strategy 节点** | 新增 `STRATEGY_SELECTION` 模板 | 覆盖决策层能力 |
| **依赖缺口计算** | 新增 `calculateDependencyGaps()` | 用于 Pattern 修正 |
| **Pattern 修正** | 引入依赖结构，避免误判 | 扣除前置影响 |
| **根本原因分析** | Pattern 增加 `rootCause` | 更精准的诊断 |
| **最小闭环验证** | 新增 Phase 0 | 先验证系统收敛再开发 |

### v2.3 → v2.4 差异

| 模块 | v2.3 | v2.4 |
|------|------|------|
| 参数 | 人工设 | 可学习 |
| 节点层次 | 4层 | 5层（+策略） |
| Pattern | 看结果 | 看因果 |
| 验证 | 无 | Phase 0 闭环 |

---

**文档版本**: v2.4（可验证版）
**最后更新**: 2026-04-26
**状态**: 可执行规格 + 闭环验证设计
**下一步**: 运行最小闭环验证（Phase 0）
