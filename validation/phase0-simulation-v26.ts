/**
 * Phase 0: 最小闭环验证 v2.6
 *
 * 目标：验证 Question Graph v2.6 系统的工程稳定性
 *
 * v2.6 新增验证指标：
 * - 正交性：三个误差维度是否独立
 * - 局部化：节点级惩罚是否独立工作
 * - 经验覆盖：是否有足够的外部信号数据
 *
 * 运行方式：
 * ```bash
 * npx tsx validation/phase0-simulation-v26.ts
 * ```
 */

// ============================================================
// 1. 基础类型定义
// ============================================================

enum NodeType {
  RECOGNITION = 'recognition',
  CONCEPT = 'concept',
  COMPUTATION = 'computation',
  APPLICATION = 'application',
  REASONING = 'reasoning',
}

enum NodeTemplate {
  COMPUTATION_SINGLE = 'computation_single',
  RECOGNITION_BINARY = 'recognition_binary',
  CONCEPT_DEFINITION = 'concept_definition',
  APPLICATION_MODELING = 'application_modeling',
  STRATEGY_SELECTION = 'strategy_selection',
}

enum ContributionLevel {
  LOW = 0.2,
  MEDIUM = 0.5,
  HIGH = 1.0,
}

interface CognitiveNode {
  id: string;
  template: NodeTemplate;
  knowledgeUnit: string;
  type: NodeType;
  description: string;
  difficulty: number;
  importance: number;
  dependencies: { prerequisiteId: string; strength: 'strong' | 'weak' }[];
  decayRate: number;
}

interface NodeMastery {
  nodeId: string;
  level: number;
  confidence: number;
  decayedLevel: number;
  lastAttempt: number;
  lastUpdated: number;
}

interface SubQuestion {
  questionId: string;
  nodeContributions: { nodeId: string; level: ContributionLevel; required: boolean }[];
  difficulty: number;
  discrimination: number;
}

interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  duration: number;
  timestamp: number;
}

// ============================================================
// 2. v2.6 新增类型
// ============================================================

/**
 * 反事实误差
 *
 * 核心思想：固定其他参数，只看单一参数的边际影响
 */
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

/**
 * 节点级惩罚系统
 */
interface NodePenaltyRegistry {
  nodePenaltyMultipliers: Map<string, number>;
  edgePenaltyMultipliers: Map<string, number>;
  globalPenaltyMultiplier: number;
  getNodePenalty(nodeId: string): number;
  getEdgePenalty(sourceId: string, targetId: string): number;
  calibrateNodePenalty(nodeId: string, adjustment: number): void;
  calibrateEdgePenalty(sourceId: string, targetId: string, adjustment: number): void;
}

/**
 * 外部理想信号
 */
interface EmpiricalIdealSignal {
  getIdealPrediction(
    nodeId: string,
    studentId: string,
    context: PredictionContext
  ): number;
  recordResult(
    nodeId: string,
    studentId: string,
    predictedMastery: number,
    actualCorrect: boolean
  ): void;
  getEmpiricalCorrectness(nodeId: string): number;
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

/**
 * IRT 训练日志（v2.6 扩展）
 */
interface IRTTrainingLog {
  timestamp: number;
  nodeId: string;
  questionId: string;
  studentId: string;
  predictedMastery: number;
  actualCorrect: boolean;
  baseScore: number;
  weight: number;
  penalty: number;
  predictedBeforePenalty: number;
  predictedAfterPenalty: number;
  questionDiscrimination: number;
  nodeImportance: number;
  contributionLevel: ContributionLevel;
  dependencyPrereqScores: Map<string, number>;
  // v2.6 新增
  counterfactualErrors?: CounterfactualErrors;
  empiricalIdealSignal?: number;
  nodePenaltyMultiplier?: number;
}

/**
 * 正交性验证指标
 */
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

// ============================================================
// 3. 参数配置（v2.6）
// ============================================================

const CONFIG = {
  KNOWLEDGE_UNIT: 'pythagoras',
  NODE_COUNT: 5,
  QUESTION_COUNT: 50,
  STUDENT_COUNT: 10,
  BUCKET_COUNT: 10,

  // v2.5 指标
  MIN_MONOTONICITY: 0.8,
  MIN_PREDICTION_ACCURACY: 0.65,
  MAX_CONVERGENCE_QUESTIONS: 10,

  // v2.6 新增指标
  MIN_ORTHOGONALITY: 0.7,
  MIN_LOCALIZATION: 0.6,
  MIN_EMPIRICAL_COVERAGE: 0.5,
};

const DEFAULT_PARAMS = {
  CONTRIBUTION_WEIGHTS: {
    LOW: 0.2,
    MEDIUM: 0.5,
    HIGH: 1.0,
  },
  DEPENDENCY_PENALTIES: {
    STRONG: 0.5,
    WEAK: 0.9,
  },
  DECAY_RATES: {
    RECOGNITION: 0.03,
    CONCEPT: 0.03,
    COMPUTATION: 0.02,
    APPLICATION: 0.08,
    STRATEGY: 0.05,
  },
  MASTERY_THRESHOLDS: {
    PREREQUISITE: 0.7,
    MASTERED: 0.8,
  },

  // v2.6 新增
  COUNTERFACTUAL: {
    MIN_ORTHOGONALITY: 0.7,
    MIN_DOMINANCE_RATIO: 0.4,
    MARGINAL_IMPACT_THRESHOLD: 0.05,
  },
  NODE_PENALTY: {
    DEFAULT_MULTIPLIER: 1.0,
    MIN_MULTIPLIER: 0.5,
    MAX_MULTIPLIER: 2.0,
  },
  EMPIRICAL_SIGNAL: {
    MIN_SAMPLES_FOR_PERSONAL: 5,
    BUCKET_COUNT: 10,
    SIMILAR_STUDENT_COUNT: 20,
  },
};

// ============================================================
// 4. 节点定义（勾股定理）
// ============================================================

const PYTHAGORAS_NODES: CognitiveNode[] = [
  {
    id: 'pythagoras_recognition_001',
    template: NodeTemplate.RECOGNITION_BINARY,
    knowledgeUnit: CONFIG.KNOWLEDGE_UNIT,
    type: NodeType.RECOGNITION,
    description: '识别直角三角形',
    difficulty: 0.3,
    importance: 0.8,
    dependencies: [],
    decayRate: DEFAULT_PARAMS.DECAY_RATES.RECOGNITION,
  },
  {
    id: 'pythagoras_concept_001',
    template: NodeTemplate.CONCEPT_DEFINITION,
    knowledgeUnit: CONFIG.KNOWLEDGE_UNIT,
    type: NodeType.CONCEPT,
    description: '理解勾股定理内容',
    difficulty: 0.4,
    importance: 0.9,
    dependencies: [{ prerequisiteId: 'pythagoras_recognition_001', strength: 'strong' }],
    decayRate: DEFAULT_PARAMS.DECAY_RATES.CONCEPT,
  },
  {
    id: 'pythagoras_strategy_001',
    template: NodeTemplate.STRATEGY_SELECTION,
    knowledgeUnit: CONFIG.KNOWLEDGE_UNIT,
    type: NodeType.REASONING,
    description: '判断是否使用勾股定理',
    difficulty: 0.6,
    importance: 0.9,
    dependencies: [{ prerequisiteId: 'pythagoras_concept_001', strength: 'weak' }],
    decayRate: DEFAULT_PARAMS.DECAY_RATES.STRATEGY,
  },
  {
    id: 'pythagoras_computation_001',
    template: NodeTemplate.COMPUTATION_SINGLE,
    knowledgeUnit: CONFIG.KNOWLEDGE_UNIT,
    type: NodeType.COMPUTATION,
    description: '计算平方和',
    difficulty: 0.5,
    importance: 0.9,
    dependencies: [{ prerequisiteId: 'pythagoras_concept_001', strength: 'strong' }],
    decayRate: DEFAULT_PARAMS.DECAY_RATES.COMPUTATION,
  },
  {
    id: 'pythagoras_application_001',
    template: NodeTemplate.APPLICATION_MODELING,
    knowledgeUnit: CONFIG.KNOWLEDGE_UNIT,
    type: NodeType.APPLICATION,
    description: '应用勾股定理',
    difficulty: 0.8,
    importance: 0.7,
    dependencies: [{ prerequisiteId: 'pythagoras_computation_001', strength: 'weak' }],
    decayRate: DEFAULT_PARAMS.DECAY_RATES.APPLICATION,
  },
];

// ============================================================
// 5. v2.6 核心组件
// ============================================================

/**
 * 反事实误差计算器
 */
class CounterfactualErrorCalculator {
  calculate(
    actualCorrect: boolean,
    baseScore: number,
    weight: number,
    penalty: number,
    idealValues: IdealValues
  ): CounterfactualErrors {
    const actual = actualCorrect ? 1.0 : 0.0;
    const currentPrediction = baseScore * weight * penalty;
    const currentError = Math.abs(actual - currentPrediction);

    // 反事实预测
    const cfBase = idealValues.idealBaseScore * weight * penalty;
    const errorWithIdealBase = Math.abs(actual - cfBase);
    const baseMarginalImpact = currentError - errorWithIdealBase;

    const cfWeight = baseScore * idealValues.idealWeight * penalty;
    const errorWithIdealWeight = Math.abs(actual - cfWeight);
    const weightMarginalImpact = currentError - errorWithIdealWeight;

    const cfPenalty = baseScore * weight * idealValues.idealPenalty;
    const errorWithIdealPenalty = Math.abs(actual - cfPenalty);
    const penaltyMarginalImpact = currentError - errorWithIdealPenalty;

    // 正交化误差
    const totalImpact = Math.abs(baseMarginalImpact) +
                        Math.abs(weightMarginalImpact) +
                        Math.abs(penaltyMarginalImpact);

    const baseError = totalImpact > 0 ? Math.abs(baseMarginalImpact) / totalImpact : 0;
    const weightError = totalImpact > 0 ? Math.abs(weightMarginalImpact) / totalImpact : 0;
    const penaltyError = totalImpact > 0 ? Math.abs(penaltyMarginalImpact) / totalImpact : 0;

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

  private calculateOrthogonality(
    baseImpact: number,
    weightImpact: number,
    penaltyImpact: number
  ): number {
    const impacts = [baseImpact, weightImpact, penaltyImpact];
    const magnitudes = impacts.map(Math.abs);

    const maxMag = Math.max(...magnitudes);
    const sumMag = magnitudes.reduce((a, b) => a + b, 0);

    if (sumMag === 0) return 1.0;

    const dominanceRatio = maxMag / sumMag;

    // 主导度 > 0.7 → 视为正交
    // 主导度 < 0.4 → 多参数耦合
    if (dominanceRatio > 0.7) return 1.0;
    if (dominanceRatio < 0.4) return 0.3;

    return (dominanceRatio - 0.4) / (0.7 - 0.4) * 0.7 + 0.3;
  }
}

/**
 * 节点级惩罚注册表
 */
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
    this.nodePenaltyMultipliers.set(
      nodeId,
      Math.max(DEFAULT_PARAMS.NODE_PENALTY.MIN_MULTIPLIER,
               Math.min(DEFAULT_PARAMS.NODE_PENALTY.MAX_MULTIPLIER, newValue))
    );
  }

  calibrateEdgePenalty(sourceId: string, targetId: string, adjustment: number): void {
    const key = `${sourceId}_${targetId}`;
    const current = this.getEdgePenalty(sourceId, targetId);
    const newValue = current * adjustment;
    this.edgePenaltyMultipliers.set(
      key,
      Math.max(DEFAULT_PARAMS.NODE_PENALTY.MIN_MULTIPLIER,
               Math.min(DEFAULT_PARAMS.NODE_PENALTY.MAX_MULTIPLIER, newValue))
    );
  }
}

/**
 * 外部理想信号实现
 */
class EmpiricalIdealSignalImpl implements EmpiricalIdealSignal {
  private empiricalData: Map<string, EmpiricalBucket[]> = new Map();

  getIdealPrediction(
    nodeId: string,
    studentId: string,
    context: PredictionContext
  ): number {
    // 优先级1：个人历史数据
    const personalRate = this.getPersonalCorrectness(nodeId, studentId);
    if (personalRate.sampleSize >= DEFAULT_PARAMS.EMPIRICAL_SIGNAL.MIN_SAMPLES_FOR_PERSONAL) {
      return this.adjustForDifficulty(personalRate.rate, context.questionDifficulty);
    }

    // 优先级2：全局数据
    const globalRate = this.getEmpiricalCorrectness(nodeId);
    if (globalRate > 0) {
      return this.adjustForDifficulty(globalRate, context.questionDifficulty);
    }

    // Fallback：中性预测
    return 0.5;
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

  getEmpiricalCorrectness(nodeId: string): number {
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

  private adjustForDifficulty(baseRate: number, questionDifficulty: number): number {
    const difficultyFactor = 1 - (questionDifficulty - 3) * 0.1;
    return Math.max(0, Math.min(1, baseRate * difficultyFactor));
  }

  private getMasteryBucket(mastery: number): number {
    return Math.min(9, Math.floor(mastery * 10));
  }
}

// ============================================================
// 6. 模拟学生
// ============================================================

class SimulatedStudent {
  id: string;
  trueAbilities: Map<string, number>;

  constructor(id: string, seed: number = 0) {
    this.id = `student_${id}`;
    this.trueAbilities = new Map();

    for (const node of PYTHAGORAS_NODES) {
      const ability = this.seededRandom(seed + node.id.length, 0.3, 0.95);
      this.trueAbilities.set(node.id, ability);
    }

    // 确保依赖关系
    for (const node of PYTHAGORAS_NODES) {
      for (const dep of node.dependencies) {
        const prereqAbility = this.trueAbilities.get(dep.prerequisiteId) || 0.5;
        const currentAbility = this.trueAbilities.get(node.id) || 0.5;

        if (dep.strength === 'strong' && currentAbility > prereqAbility + 0.1) {
          this.trueAbilities.set(node.id, prereqAbility + 0.05);
        }
      }
    }
  }

  private seededRandom(seed: number, min: number, max: number): number {
    const x = Math.sin(seed) * 10000;
    const normalized = x - Math.floor(x);
    return min + normalized * (max - min);
  }

  answer(question: SubQuestion): boolean {
    const contrib = question.nodeContributions[0];
    const trueAbility = this.trueAbilities.get(contrib.nodeId) || 0.5;

    const noise = (Math.random() - 0.5) * 0.2;
    const probability = trueAbility + noise;

    const adjustedProb = Math.min(1, Math.max(0,
      probability * question.discrimination + (1 - question.discrimination) * 0.5
    ));

    return Math.random() < adjustedProb;
  }

  getTrueAbility(nodeId: string): number {
    return this.trueAbilities.get(nodeId) || 0.5;
  }
}

// ============================================================
// 7. 题目生成器
// ============================================================

class QuestionGenerator {
  private nextId = 0;

  generate(nodeId: string, count: number = 1): SubQuestion[] {
    const questions: SubQuestion[] = [];

    for (let i = 0; i < count; i++) {
      questions.push({
        questionId: `q_${this.nextId++}`,
        nodeContributions: [
          {
            nodeId,
            level: this.randomLevel(),
            required: true,
          },
        ],
        difficulty: this.randomDifficulty(),
        discrimination: 0.7 + Math.random() * 0.2,
      });
    }

    return questions;
  }

  generateMixed(count: number): SubQuestion[] {
    const questions: SubQuestion[] = [];

    for (let i = 0; i < count; i++) {
      const randomNode = PYTHAGORAS_NODES[
        Math.floor(Math.random() * PYTHAGORAS_NODES.length)
      ];

      questions.push({
        questionId: `q_${this.nextId++}`,
        nodeContributions: [
          {
            nodeId: randomNode.id,
            level: this.randomLevel(),
            required: true,
          },
        ],
        difficulty: this.randomDifficulty(),
        discrimination: 0.7 + Math.random() * 0.2,
      });
    }

    return questions;
  }

  private randomLevel(): ContributionLevel {
    const r = Math.random();
    if (r < 0.3) return ContributionLevel.LOW;
    if (r < 0.7) return ContributionLevel.MEDIUM;
    return ContributionLevel.HIGH;
  }

  private randomDifficulty(): number {
    return Math.floor(Math.random() * 5) + 1;
  }
}

// ============================================================
// 8. 核心算法（v2.6）
// ============================================================

function normalizeWeights(
  contributions: { nodeId: string; level: ContributionLevel; required: boolean }[]
): Map<string, number> {
  const weights = new Map<string, number>();
  let total = 0;

  for (const contrib of contributions) {
    const node = PYTHAGORAS_NODES.find(n => n.id === contrib.nodeId);
    if (!node) continue;

    // 将 ContributionLevel 枚举值映射到键名
    const levelKey = contrib.level === 0.2 ? 'LOW' : contrib.level === 0.5 ? 'MEDIUM' : 'HIGH';
    const levelValue = DEFAULT_PARAMS.CONTRIBUTION_WEIGHTS[levelKey];
    const weight = node.importance * levelValue;
    weights.set(contrib.nodeId, weight);
    total += weight;
  }

  if (total > 0) {
    for (const [nodeId, w] of weights) {
      weights.set(nodeId, w / total);
    }
  }

  return weights;
}

function calculateNodeDependencyPenalty(
  nodeId: string,
  masteries: Map<string, NodeMastery>,
  penaltyRegistry: NodePenaltyRegistry
): number {
  const node = PYTHAGORAS_NODES.find(n => n.id === nodeId);
  if (!node || node.dependencies.length === 0) return 1.0;

  let totalPenalty = 0;
  let totalWeight = 0;

  for (const dep of node.dependencies) {
    const prereqMastery = masteries.get(dep.prerequisiteId);
    const prereqLevel = prereqMastery ? prereqMastery.decayedLevel : 0;

    const depWeight = dep.strength === 'strong' ? 0.5 : 0.1;
    const basePenalty = prereqLevel < DEFAULT_PARAMS.MASTERY_THRESHOLDS.PREREQUISITE
      ? (1 - prereqLevel) * depWeight
      : 0;

    // 使用节点级惩罚系数
    const edgeMultiplier = penaltyRegistry.getEdgePenalty(dep.prerequisiteId, nodeId);
    const adjustedPenalty = basePenalty * edgeMultiplier;

    totalPenalty += adjustedPenalty;
    totalWeight += depWeight;
  }

  const avgPenalty = totalWeight > 0 ? totalPenalty / totalWeight : 0;
  return Math.max(0, Math.min(1, 1 - avgPenalty));
}

function getIdealWeight(nodeId: string): number {
  const node = PYTHAGORAS_NODES.find(n => n.id === nodeId);
  return node ? node.importance : 0.5;
}

// ============================================================
// 9. 闭环模拟（v2.6）
// ============================================================

interface SimulationResult {
  studentId: string;
  questionId: string;
  nodeId: string;
  questionIndex: number;
  predictedMastery: number;
  trueAbility: number;
  actualCorrect: boolean;
  predictedCorrect: boolean;
  finalMastery: number;
  // v2.6 新增
  counterfactualErrors?: CounterfactualErrors;
  empiricalIdealSignal?: number;
  nodePenaltyMultiplier?: number;
}

interface Phase0Result {
  passed: boolean;
  monotonicityScore: number;
  predictionAccuracy: number;
  masteryCorrelation: number;
  convergenceRate: number;
  // v2.6 新增
  orthogonalityScore: number;
  localizationScore: number;
  empiricalCoverage: number;
  details: {
    bucketCorrectRates: number[];
    orthogonalityMetrics: OrthogonalityMetrics;
  };
}

function runPhase0SimulationV26(): {
  results: SimulationResult[];
  result: Phase0Result;
  finalMasteries: Map<string, Map<string, number>>;
  masteryHistory: Map<string, Map<string, number[]>>;
} {
  console.log('=== Phase 0: 最小闭环验证 v2.6 ===\n');

  // 初始化 v2.6 组件
  const errorCalculator = new CounterfactualErrorCalculator();
  const penaltyRegistry = new NodePenaltyRegistryImpl();
  const empiricalSignal = new EmpiricalIdealSignalImpl();

  const questionGenerator = new QuestionGenerator();
  const questions = questionGenerator.generateMixed(CONFIG.QUESTION_COUNT);
  const students: SimulatedStudent[] = [];

  for (let i = 0; i < CONFIG.STUDENT_COUNT; i++) {
    students.push(new SimulatedStudent(String(i), i * 100));
  }

  const results: SimulationResult[] = [];
  const finalMasteries = new Map<string, Map<string, number>>();
  const masteryHistory = new Map<string, Map<string, number[]>>();

  for (const student of students) {
    let masteries = new Map<string, NodeMastery>();
    masteryHistory.set(student.id, new Map());

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const nodeId = question.nodeContributions[0].nodeId;

      if (!masteryHistory.get(student.id)!.has(nodeId)) {
        masteryHistory.get(student.id)!.set(nodeId, []);
      }

      const currentMastery = masteries.get(nodeId)?.level || 0.5;
      masteryHistory.get(student.id)!.get(nodeId)!.push(currentMastery);

      // 获取外部理想信号
      const empiricalIdeal = empiricalSignal.getIdealPrediction(
        nodeId,
        student.id,
        {
          questionDifficulty: question.difficulty,
          questionDiscrimination: question.discrimination,
          timeOfDay: new Date().getHours(),
          daysSinceLastPractice: masteries.get(nodeId)
            ? (Date.now() - masteries.get(nodeId)!.lastUpdated) / (1000 * 60 * 60 * 24)
            : 999,
        }
      );

      // 计算反事实误差
      const weights = normalizeWeights(question.nodeContributions);
      const weight = weights.get(nodeId) || 0.5;
      const penalty = calculateNodeDependencyPenalty(nodeId, masteries, penaltyRegistry);
      const nodePenaltyMultiplier = penaltyRegistry.getNodePenalty(nodeId);

      const baseScore = currentMastery;  // 简化：用当前 mastery 作为 base
      const idealValues: IdealValues = {
        idealBaseScore: empiricalIdeal,  // 使用外部信号
        idealWeight: getIdealWeight(nodeId),
        idealPenalty: 1.0,
      };

      const cfErrors = errorCalculator.calculate(
        false,  // actualCorrect 未知（答题前）
        baseScore,
        weight,
        penalty,
        idealValues
      );

      const predictedCorrect = baseScore * weight * penalty > 0.5;

      // 答题
      const actualCorrect = student.answer(question);

      // 记录结果（更新 cfErrors 为实际值）
      const actualCfErrors = errorCalculator.calculate(
        actualCorrect,
        actualCorrect ? 1.0 : 0.0,
        weight,
        penalty,
        idealValues
      );

      results.push({
        studentId: student.id,
        questionId: question.questionId,
        nodeId,
        questionIndex: i,
        predictedMastery: currentMastery,
        trueAbility: student.getTrueAbility(nodeId),
        actualCorrect,
        predictedCorrect,
        finalMastery: 0,
        counterfactualErrors: actualCfErrors,
        empiricalIdealSignal: empiricalIdeal,
        nodePenaltyMultiplier,
      });

      // 记录到经验信号
      empiricalSignal.recordResult(nodeId, student.id, currentMastery, actualCorrect);

      // 更新 mastery
      const node = PYTHAGORAS_NODES.find(n => n.id === nodeId);
      let mastery = masteries.get(nodeId);

      if (!mastery) {
        mastery = {
          nodeId,
          level: 0.5,
          confidence: 0.1,
          decayedLevel: 0.5,
          lastAttempt: Date.now(),
          lastUpdated: Date.now(),
        };
        masteries.set(nodeId, mastery);
      }

      const alpha = 0.2;
      const targetLevel = actualCorrect ? 1.0 : 0.0;
      mastery.level = alpha * targetLevel + (1 - alpha) * mastery.level;
      mastery.confidence = Math.min(1.0, mastery.confidence + 0.02);
      mastery.lastAttempt = Date.now();
      mastery.lastUpdated = Date.now();

      const decayFactor = Math.exp(-node!.decayRate * 0);
      mastery.decayedLevel = mastery.level * decayFactor;
    }

    finalMasteries.set(student.id, new Map());
    for (const [nodeId, mastery] of masteries) {
      finalMasteries.get(student.id)!.set(nodeId, mastery.level);
    }
  }

  for (const r of results) {
    r.finalMastery = finalMasteries.get(r.studentId)!.get(r.nodeId) || 0.5;
  }

  const result = validateLoopV26(results, finalMasteries, masteryHistory);

  return { results, result, finalMasteries, masteryHistory };
}

// ============================================================
// 10. 验证指标（v2.6）
// ============================================================

function validateLoopV26(
  results: SimulationResult[],
  finalMasteries: Map<string, Map<string, number>>,
  masteryHistory: Map<string, Map<string, number[]>>
): Phase0Result {
  console.log('--- 验证指标 v2.6 ---\n');

  // v2.5 指标
  const bucketCorrectRates = calculateBucketCorrectRates(results);

  let monotonicCount = 0;
  for (let i = 1; i < bucketCorrectRates.length; i++) {
    if (bucketCorrectRates[i] >= bucketCorrectRates[i - 1] - 0.05) {
      monotonicCount++;
    }
  }
  const monotonicityScore = monotonicCount / (bucketCorrectRates.length - 1);

  const masteryCorrelation = calculateCorrelation(results, finalMasteries);

  let correctPredictions = 0;
  for (const r of results) {
    if (r.predictedCorrect === r.actualCorrect) {
      correctPredictions++;
    }
  }
  const predictionAccuracy = correctPredictions / results.length;

  const convergenceRate = calculateConvergenceRate(masteryHistory);

  // v2.6 新增指标
  const orthogonalityMetrics = calculateOrthogonality(results);
  const localizationScore = calculateLocalization(results);
  const empiricalCoverage = calculateEmpiricalCoverage(results);

  // 打印结果
  console.log(`=== v2.5 指标 ===`);
  console.log('各桶正确率 (按 trueAbility 分桶):');
  bucketCorrectRates.forEach((rate, i) => {
    const bucketRange = `[${i / CONFIG.BUCKET_COUNT}, ${(i + 1) / CONFIG.BUCKET_COUNT})`;
    console.log(`  ${bucketRange}: ${(rate * 100).toFixed(1)}%`);
  });
  console.log(`单调性分数: ${monotonicityScore.toFixed(3)} (目标: >${CONFIG.MIN_MONOTONICITY})`);
  console.log(`Mastery-Ability 相关性: ${(masteryCorrelation * 100).toFixed(1)}% (目标: >${(CONFIG.MIN_PREDICTION_ACCURACY * 100).toFixed(0)}%)`);
  console.log(`预测准确率: ${(predictionAccuracy * 100).toFixed(1)}%`);
  console.log(`收敛速度: ${convergenceRate.toFixed(1)} 题 (目标: <${CONFIG.MAX_CONVERGENCE_QUESTIONS})`);

  console.log(`\n=== v2.6 新增指标 ===`);
  console.log(`正交性得分: ${orthogonalityMetrics.orthogonalityScore.toFixed(3)} (目标: >${CONFIG.MIN_ORTHOGONALITY})`);
  console.log(`  - 主导度: ${orthogonalityMetrics.dominanceRatio.toFixed(3)}`);
  console.log(`  - base-weight 相关: ${orthogonalityMetrics.correlationMatrix.base_weight.toFixed(3)}`);
  console.log(`  - base-penalty 相关: ${orthogonalityMetrics.correlationMatrix.base_penalty.toFixed(3)}`);
  console.log(`  - weight-penalty 相关: ${orthogonalityMetrics.correlationMatrix.weight_penalty.toFixed(3)}`);
  console.log(`局部化得分: ${localizationScore.toFixed(3)} (目标: >${CONFIG.MIN_LOCALIZATION})`);
  console.log(`经验覆盖率: ${(empiricalCoverage * 100).toFixed(1)}% (目标: >${(CONFIG.MIN_EMPIRICAL_COVERAGE * 100).toFixed(0)}%)`);

  // 判断是否通过
  const passed =
    monotonicityScore >= CONFIG.MIN_MONOTONICITY &&
    masteryCorrelation >= CONFIG.MIN_PREDICTION_ACCURACY &&
    convergenceRate <= CONFIG.MAX_CONVERGENCE_QUESTIONS &&
    orthogonalityMetrics.orthogonalityScore >= CONFIG.MIN_ORTHOGONALITY &&
    localizationScore >= CONFIG.MIN_LOCALIZATION &&
    empiricalCoverage >= CONFIG.MIN_EMPIRICAL_COVERAGE;

  console.log(`\n=== 最终结果 ===`);
  console.log(`状态: ${passed ? '✅ 系统验证通过 (v2.6)' : '❌ 系统验证未通过'}`);

  if (passed) {
    console.log('\n🎉 Phase 0 v2.6 验证通过！系统可以进入生产验证阶段。');
  } else {
    console.log('\n⚠️ Phase 0 v2.6 验证未通过，需要调整参数。');
  }

  return {
    passed,
    monotonicityScore,
    predictionAccuracy,
    masteryCorrelation,
    convergenceRate,
    orthogonalityScore: orthogonalityMetrics.orthogonalityScore,
    localizationScore,
    empiricalCoverage,
    details: {
      bucketCorrectRates,
      orthogonalityMetrics,
    },
  };
}

function calculateOrthogonality(results: SimulationResult[]): OrthogonalityMetrics {
  const cfErrorsList = results
    .filter(r => r.counterfactualErrors !== undefined)
    .map(r => r.counterfactualErrors!);

  if (cfErrorsList.length < 10) {
    return {
      correlationMatrix: { base_weight: 0, base_penalty: 0, weight_penalty: 0 },
      dominanceRatio: 0,
      orthogonalityScore: 0,
      isOrthogonal: false,
    };
  }

  const baseImpacts = cfErrorsList.map(e => e.baseMarginalImpact);
  const weightImpacts = cfErrorsList.map(e => e.weightMarginalImpact);
  const penaltyImpacts = cfErrorsList.map(e => e.penaltyMarginalImpact);

  const baseWeightCorr = pearsonCorrelation(baseImpacts, weightImpacts);
  const basePenaltyCorr = pearsonCorrelation(baseImpacts, penaltyImpacts);
  const weightPenaltyCorr = pearsonCorrelation(weightImpacts, penaltyImpacts);

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

  const avgCorr = (Math.abs(baseWeightCorr) + Math.abs(basePenaltyCorr) + Math.abs(weightPenaltyCorr)) / 3;
  const orthogonalityScore = (1 - avgCorr) * 0.6 + dominanceRatio * 0.4;

  return {
    correlationMatrix: {
      base_weight: baseWeightCorr,
      base_penalty: basePenaltyCorr,
      weight_penalty: weightPenaltyCorr,
    },
    dominanceRatio,
    orthogonalityScore,
    isOrthogonal: orthogonalityScore > CONFIG.MIN_ORTHOGONALITY,
  };
}

function calculateLocalization(results: SimulationResult[]): number {
  // 验证不同节点的 penalty multiplier 是否独立变化
  const nodePenalties = new Map<string, number[]>();

  for (const r of results) {
    if (r.nodePenaltyMultiplier !== undefined) {
      if (!nodePenalties.has(r.nodeId)) {
        nodePenalties.set(r.nodeId, []);
      }
      nodePenalties.get(r.nodeId)!.push(r.nodePenaltyMultiplier);
    }
  }

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
        independentPairs++;
      }
    }
  }

  return totalPairs > 0 ? independentPairs / totalPairs : 1.0;
}

function calculateEmpiricalCoverage(results: SimulationResult[]): number {
  const nodeDataCounts = new Map<string, number>();

  for (const r of results) {
    nodeDataCounts.set(r.nodeId, (nodeDataCounts.get(r.nodeId) || 0) + 1);
  }

  let coveredNodes = 0;
  for (const count of nodeDataCounts.values()) {
    if (count >= DEFAULT_PARAMS.EMPIRICAL_SIGNAL.MIN_SAMPLES_FOR_PERSONAL) {
      coveredNodes++;
    }
  }

  return nodeDataCounts.size > 0 ? coveredNodes / nodeDataCounts.size : 0;
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

function calculateConvergenceRate(
  masteryHistory: Map<string, Map<string, number[]>>
): number {
  const convergencePoints: number[] = [];
  const STABILITY_THRESHOLD = 0.05;
  const MIN_STABLE_COUNT = 3;

  for (const [studentId, nodeHistory] of masteryHistory) {
    for (const [nodeId, history] of nodeHistory) {
      if (history.length < MIN_STABLE_COUNT) continue;

      let stableCount = 0;
      for (let i = 1; i < history.length; i++) {
        const change = Math.abs(history[i] - history[i - 1]);
        if (change < STABILITY_THRESHOLD) {
          stableCount++;
        } else {
          stableCount = 0;
        }

        if (stableCount >= MIN_STABLE_COUNT) {
          convergencePoints.push(i);
          break;
        }
      }

      if (stableCount >= history.length - MIN_STABLE_COUNT) {
        convergencePoints.push(MIN_STABLE_COUNT);
      }
    }
  }

  if (convergencePoints.length === 0) {
    return CONFIG.QUESTION_COUNT;
  }

  return convergencePoints.reduce((a, b) => a + b, 0) / convergencePoints.length;
}

function calculateCorrelation(
  results: SimulationResult[],
  finalMasteries: Map<string, Map<string, number>>
): number {
  const pairs: { trueAbility: number; mastery: number }[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const key = `${r.studentId}-${r.nodeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({
        trueAbility: r.trueAbility,
        mastery: finalMasteries.get(r.studentId)!.get(r.nodeId) || 0.5,
      });
    }
  }

  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const meanTrue = pairs.reduce((s, p) => s + p.trueAbility, 0) / n;
  const meanMastery = pairs.reduce((s, p) => s + p.mastery, 0) / n;

  let numerator = 0;
  let sumSqTrue = 0;
  let sumSqMastery = 0;

  for (const p of pairs) {
    const diffTrue = p.trueAbility - meanTrue;
    const diffMastery = p.mastery - meanMastery;
    numerator += diffTrue * diffMastery;
    sumSqTrue += diffTrue * diffTrue;
    sumSqMastery += diffMastery * diffMastery;
  }

  const denominator = Math.sqrt(sumSqTrue * sumSqMastery);
  if (denominator === 0) return 0;

  return Math.abs(numerator / denominator);
}

function calculateBucketCorrectRates(results: SimulationResult[]): number[] {
  const buckets = Array.from({ length: CONFIG.BUCKET_COUNT }, () => ({
    correct: 0,
    total: 0,
  }));

  for (const r of results) {
    const bucketIndex = Math.min(
      CONFIG.BUCKET_COUNT - 1,
      Math.floor(r.trueAbility * CONFIG.BUCKET_COUNT)
    );
    buckets[bucketIndex].total++;
    if (r.actualCorrect) {
      buckets[bucketIndex].correct++;
    }
  }

  return buckets.map(b => (b.total > 0 ? b.correct / b.total : 0));
}

// ============================================================
// 11. 主函数
// ============================================================

function main() {
  console.log('Question Graph v2.6 - Phase 0 闭环验证\n');
  console.log(`配置:`);
  console.log(`  节点数: ${PYTHAGORAS_NODES.length}`);
  console.log(`  题目数: ${CONFIG.QUESTION_COUNT}`);
  console.log(`  学生数: ${CONFIG.STUDENT_COUNT}`);
  console.log(`  总样本数: ${CONFIG.QUESTION_COUNT * CONFIG.STUDENT_COUNT}\n`);

  const { result } = runPhase0SimulationV26();

  return result.passed ? 0 : 1;
}

if (require.main === module) {
  process.exit(main());
}

export { main, runPhase0SimulationV26 };
export type { Phase0Result, SimulationResult };
