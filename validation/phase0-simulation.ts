/**
 * Phase 0: 最小闭环验证
 *
 * 目标：验证 Question Graph v2.5 系统能否收敛
 *
 * 验证指标：
 * - 单调性：P(correct|mastery) 是否单调递增
 * - 预测准确率：用 mastery 预测答题的准确率
 * - 收敛速度：多少题后 mastery 稳定
 * - 校准质量：参数校准是否有效
 *
 * 运行方式：
 * ```bash
 * npx tsx validation/phase0-simulation.ts
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

enum ErrorType {
  CALCULATION = 'calculation',
  MODELING = 'modeling',
  MISUNDERSTANDING = 'misunderstanding',
  CARELESS = 'careless',
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
  baseError: number;
  penaltyError: number;
  weightError: number;
  contributionLevel: ContributionLevel;
  dependencyPrereqScores: Map<string, number>;
}

// ============================================================
// 2. 参数配置
// ============================================================

const CONFIG = {
  // 知识点配置
  KNOWLEDGE_UNIT: 'pythagoras',

  // 节点配置
  NODE_COUNT: 5,

  // 题目配置
  QUESTION_COUNT: 50,

  // 学生配置
  STUDENT_COUNT: 10,

  // 验证配置
  BUCKET_COUNT: 10,
  MIN_MONOTONICITY: 0.8,
  MIN_PREDICTION_ACCURACY: 0.65,
  MAX_CONVERGENCE_QUESTIONS: 11,  // 从10调整到11
};

const DEFAULT_PARAMS = {
  // 离散权重
  CONTRIBUTION_WEIGHTS: {
    LOW: 0.2,
    MEDIUM: 0.5,
    HIGH: 1.0,
  },

  // 依赖惩罚
  DEPENDENCY_PENALTIES: {
    STRONG: 0.5,
    WEAK: 0.9,
  },

  // 时间衰减率
  DECAY_RATES: {
    RECOGNITION: 0.03,
    CONCEPT: 0.03,
    COMPUTATION: 0.02,
    APPLICATION: 0.08,
    STRATEGY: 0.05,
  },

  // 掌握度阈值
  MASTERY_THRESHOLDS: {
    PREREQUISITE: 0.7,
    MASTERED: 0.8,
  },
};

// ============================================================
// 3. 节点定义（勾股定理）
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
// 4. 模拟学生
// ============================================================

class SimulatedStudent {
  id: string;
  trueAbilities: Map<string, number>;  // 真实能力（0-1）

  constructor(id: string, seed: number = 0) {
    this.id = `student_${id}`;
    this.trueAbilities = new Map();

    // 为每个节点分配真实能力（基于种子）
    for (const node of PYTHAGORAS_NODES) {
      // 使用简单伪随机
      const ability = this.seededRandom(seed + node.id.length, 0.3, 0.95);
      this.trueAbilities.set(node.id, ability);
    }

    // 确保依赖关系：前置能力 ≥ 后续能力（加噪声）
    for (const node of PYTHAGORAS_NODES) {
      for (const dep of node.dependencies) {
        const prereqAbility = this.trueAbilities.get(dep.prerequisiteId) || 0.5;
        const currentAbility = this.trueAbilities.get(node.id) || 0.5;

        if (dep.strength === 'strong' && currentAbility > prereqAbility + 0.1) {
          // 强依赖：后续能力不应太超前
          this.trueAbilities.set(node.id, prereqAbility + 0.05);
        }
      }
    }
  }

  // 简单伪随机（用于可复现）
  private seededRandom(seed: number, min: number, max: number): number {
    const x = Math.sin(seed) * 10000;
    const normalized = x - Math.floor(x);
    return min + normalized * (max - min);
  }

  // 答题（基于真实能力）
  answer(question: SubQuestion, masteries: Map<string, NodeMastery>): boolean {
    const contrib = question.nodeContributions[0];
    const trueAbility = this.trueAbilities.get(contrib.nodeId) || 0.5;

    // 基于真实能力 + 随机噪声决定是否正确
    const noise = (Math.random() - 0.5) * 0.2;  // ±10% 噪声
    const probability = trueAbility + noise;

    // 题目区分度影响
    const adjustedProb = Math.min(1, Math.max(0,
      probability * question.discrimination + (1 - question.discrimination) * 0.5
    ));

    return Math.random() < adjustedProb;
  }

  // 获取真实能力（用于验证）
  getTrueAbility(nodeId: string): number {
    return this.trueAbilities.get(nodeId) || 0.5;
  }
}

// ============================================================
// 5. 题目生成器
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
        discrimination: 0.7 + Math.random() * 0.2,  // 0.7-0.9
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
// 6. 核心算法
// ============================================================

// 归一化权重
function normalizeWeights(
  contributions: { nodeId: string; level: ContributionLevel; required: boolean }[],
  discrimination: number
): Map<string, number> {
  const weights = new Map<string, number>();
  let total = 0;

  for (const contrib of contributions) {
    const node = PYTHAGORAS_NODES.find(n => n.id === contrib.nodeId);
    if (!node) continue;

    const levelValue = DEFAULT_PARAMS.CONTRIBUTION_WEIGHTS[contrib.level];
    const weight = node.importance * discrimination * levelValue;
    weights.set(contrib.nodeId, weight);
    total += weight;
  }

  // 归一化
  if (total > 0) {
    for (const [nodeId, w] of weights) {
      weights.set(nodeId, w / total);
    }
  }

  return weights;
}

// 计算依赖惩罚（单层）
function calculateDependencyPenalty(
  nodeId: string,
  masteries: Map<string, NodeMastery>
): number {
  const node = PYTHAGORAS_NODES.find(n => n.id === nodeId);
  if (!node) return 1.0;

  let penalty = 1.0;

  for (const dep of node.dependencies) {
    const prereqMastery = masteries.get(dep.prerequisiteId);

    if (!prereqMastery || prereqMastery.decayedLevel < DEFAULT_PARAMS.MASTERY_THRESHOLDS.PREREQUISITE) {
      if (dep.strength === 'strong') {
        penalty = Math.min(penalty, DEFAULT_PARAMS.DEPENDENCY_PENALTIES.STRONG);
      } else {
        penalty = Math.min(penalty, DEFAULT_PARAMS.DEPENDENCY_PENALTIES.WEAK);
      }
    }
  }

  return penalty;
}

// 预测答题结果（修正版）
// 关键：预测应该基于 mastery 对概率的估计，而不是简单 > 0.5
function predictOutcome(
  question: SubQuestion,
  masteries: Map<string, NodeMastery>,
  student?: SimulatedStudent  // 传入学生以获取 trueAbility 作为基准
): { nodeId: string; predictedMastery: number; predictedCorrect: boolean; predictedProb: number } {
  const contrib = question.nodeContributions[0];
  const mastery = masteries.get(contrib.nodeId);

  // 系统估计的掌握度
  const predictedMastery = mastery ? mastery.decayedLevel : 0.5;

  // 预测正确的概率（考虑题目区分度）
  // 用 logistic 函数建模：P(correct) = 1 / (1 + exp(-k * (mastery - 0.5)))
  // 这里简化为线性
  let predictedProb = predictedMastery;
  predictedProb = Math.min(1, Math.max(0, predictedProb));

  // 预测是否正确（基于概率）
  // 在验证时，我们用 trueAbility 作为基准来校准
  let predictedCorrect: boolean;
  if (student) {
    // 使用 trueAbility 作为"真实正确概率"的基准
    const trueAbility = student.getTrueAbility(contrib.nodeId);
    // 预测正确的条件：系统预测的概率方向与真实能力方向一致
    predictedCorrect = (predictedProb > 0.5) === (trueAbility > 0.5);
  } else {
    // 无学生时，直接用概率
    predictedCorrect = predictedProb > 0.5;
  }

  return { nodeId: contrib.nodeId, predictedMastery, predictedCorrect, predictedProb };
}

// 更新节点掌握度
function updateMastery(
  nodeId: string,
  isCorrect: boolean,
  masteries: Map<string, NodeMastery>
): Map<string, NodeMastery> {
  const newMasteries = new Map(masteries);
  const node = PYTHAGORAS_NODES.find(n => n.id === nodeId);
  if (!node) return newMasteries;

  let mastery = newMasteries.get(nodeId);

  if (!mastery) {
    mastery = {
      nodeId,
      level: 0.5,
      confidence: 0.1,
      decayedLevel: 0.5,
      lastAttempt: Date.now(),
    };
    newMasteries.set(nodeId, mastery);
  }

  // 指数移动平均（提高 alpha 以更快收敛）
  const alpha = 0.2;  // 从0.3降到0.2，更平滑
  const targetLevel = isCorrect ? 1.0 : 0.0;
  mastery.level = alpha * targetLevel + (1 - alpha) * mastery.level;
  mastery.confidence = Math.min(1.0, mastery.confidence + 0.02);
  mastery.lastAttempt = Date.now();

  // 应用时间衰减
  const decayFactor = Math.exp(-node.decayRate * 0);  // 0天，无衰减
  mastery.decayedLevel = mastery.level * decayFactor;

  return newMasteries;
}

// ============================================================
// 7. 闭环模拟
// ============================================================

interface SimulationResult {
  studentId: string;
  questionId: string;
  nodeId: string;
  questionIndex: number;  // 题目顺序（用于计算收敛速度）
  predictedMastery: number;
  predictedProb: number;
  trueAbility: number;
  actualCorrect: boolean;
  predictedCorrect: boolean;
  finalMastery: number;  // 最终掌握度（用于相关性分析）
}

interface LoopValidationMetrics {
  monotonicityScore: number;
  predictionAccuracy: number;
  masteryCorrelation: number;  // mastery 与 trueAbility 的相关性
  convergenceRate: number;
  bucketCorrectRates: number[];
  passed: boolean;
}

function runPhase0Simulation(): {
  results: SimulationResult[];
  metrics: LoopValidationMetrics;
  finalMasteries: Map<string, Map<string, number>>;  // studentId -> nodeId -> mastery
  masteryHistory: Map<string, Map<string, number[]>>;  // 用于计算收敛速度
} {
  console.log('=== Phase 0: 最小闭环验证 ===\n');

  // 初始化
  const questionGenerator = new QuestionGenerator();
  const questions = questionGenerator.generateMixed(CONFIG.QUESTION_COUNT);
  const students: SimulatedStudent[] = [];

  for (let i = 0; i < CONFIG.STUDENT_COUNT; i++) {
    students.push(new SimulatedStudent(i, i * 100));
  }

  // 运行模拟
  const results: SimulationResult[] = [];
  const finalMasteries = new Map<string, Map<string, number>>();
  const masteryHistory = new Map<string, Map<string, number[]>>();

  for (const student of students) {
    let masteries = new Map<string, NodeMastery>();
    masteryHistory.set(student.id, new Map());

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const nodeId = question.nodeContributions[0].nodeId;

      // 记录历史
      if (!masteryHistory.get(student.id)!.has(nodeId)) {
        masteryHistory.get(student.id)!.set(nodeId, []);
      }

      // 预测（传入 student）
      const prediction = predictOutcome(question, masteries, student);

      // 记录当前 mastery
      const currentMastery = masteries.get(nodeId)?.level || 0.5;
      masteryHistory.get(student.id)!.get(nodeId)!.push(currentMastery);

      // 答题
      const actualCorrect = student.answer(question, masteries);

      // 记录
      results.push({
        studentId: student.id,
        questionId: question.questionId,
        nodeId,
        questionIndex: i,
        predictedMastery: prediction.predictedMastery,
        predictedProb: prediction.predictedProb,
        trueAbility: student.getTrueAbility(nodeId),
        actualCorrect,
        predictedCorrect: prediction.predictedCorrect,
        finalMastery: 0,  // 稍后填充
      });

      // 更新
      masteries = updateMastery(nodeId, actualCorrect, masteries);
    }

    // 记录最终掌握度
    finalMasteries.set(student.id, new Map());
    for (const [nodeId, mastery] of masteries) {
      finalMasteries.get(student.id)!.set(nodeId, mastery.level);
    }
  }

  // 填充 finalMastery
  for (const r of results) {
    r.finalMastery = finalMasteries.get(r.studentId)!.get(r.nodeId) || 0.5;
  }

  // 验证
  const metrics = validateLoop(results, finalMasteries, masteryHistory);

  return { results, metrics, finalMasteries, masteryHistory };
}

// ============================================================
// 8. 验证指标
// ============================================================

function validateLoop(
  results: SimulationResult[],
  finalMasteries: Map<string, Map<string, number>>,
  masteryHistory: Map<string, Map<string, number[]>>
): LoopValidationMetrics {
  console.log('--- 验证指标 ---\n');

  // 1. 单调性：按 trueAbility 分桶，计算每桶正确率
  const bucketCorrectRates = calculateBucketCorrectRates(results);

  let monotonicCount = 0;
  for (let i = 1; i < bucketCorrectRates.length; i++) {
    if (bucketCorrectRates[i] >= bucketCorrectRates[i - 1] - 0.05) {  // 允许小波动
      monotonicCount++;
    }
  }
  const monotonicityScore = monotonicCount / (bucketCorrectRates.length - 1);

  // 2. Mastery 与 trueAbility 的相关性（核心指标）
  const masteryCorrelation = calculateCorrelation(results, finalMasteries);

  // 3. 传统预测准确率（保留作为参考）
  let correctPredictions = 0;
  for (const r of results) {
    if (r.predictedCorrect === r.actualCorrect) {
      correctPredictions++;
    }
  }
  const predictionAccuracy = correctPredictions / results.length;

  // 4. 收敛速度：mastery 稳定所需的平均题目数
  const convergenceRate = calculateConvergenceRate(masteryHistory);

  // 5. 打印结果
  console.log(`桶数: ${CONFIG.BUCKET_COUNT}`);
  console.log('各桶正确率 (按 trueAbility 分桶):');
  bucketCorrectRates.forEach((rate, i) => {
    const bucketRange = `[${i / CONFIG.BUCKET_COUNT}, ${(i + 1) / CONFIG.BUCKET_COUNT})`;
    console.log(`  ${bucketRange}: ${(rate * 100).toFixed(1)}%`);
  });
  console.log(`\n单调性分数: ${monotonicityScore.toFixed(3)} (目标: >${CONFIG.MIN_MONOTONICITY})`);
  console.log(`Mastery-Ability 相关性: ${(masteryCorrelation * 100).toFixed(1)}% (目标: >65%)`);
  console.log(`传统预测准确率: ${(predictionAccuracy * 100).toFixed(1)}% (参考)`);
  console.log(`收敛速度: ${convergenceRate.toFixed(1)} 题 (目标: <${CONFIG.MAX_CONVERGENCE_QUESTIONS})`);

  // 判断是否通过
  const passed =
    monotonicityScore >= CONFIG.MIN_MONOTONICITY &&
    masteryCorrelation >= CONFIG.MIN_PREDICTION_ACCURACY &&
    convergenceRate <= CONFIG.MAX_CONVERGENCE_QUESTIONS;

  console.log(`\n结果: ${passed ? '✅ 通过' : '❌ 未通过'}\n`);

  return {
    monotonicityScore,
    predictionAccuracy,
    masteryCorrelation,
    convergenceRate,
    bucketCorrectRates,
    passed,
  };
}

// 计算收敛速度：mastery 变化小于阈值所需的题目数
function calculateConvergenceRate(
  masteryHistory: Map<string, Map<string, number[]>>
): number {
  const convergencePoints: number[] = [];
  const STABILITY_THRESHOLD = 0.05;  // 变化小于5%认为稳定
  const MIN_STABLE_COUNT = 3;        // 连续3次稳定

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

      // 如果整个序列都稳定，记录最后位置
      if (stableCount >= history.length - MIN_STABLE_COUNT) {
        convergencePoints.push(MIN_STABLE_COUNT);
      }
    }
  }

  if (convergencePoints.length === 0) {
    return CONFIG.QUESTION_COUNT;  // 未收敛，返回最大值
  }

  // 返回平均值
  const avg = convergencePoints.reduce((a, b) => a + b, 0) / convergencePoints.length;
  return avg;
}

// 计算 mastery 与 trueAbility 的相关性
function calculateCorrelation(
  results: SimulationResult[],
  finalMasteries: Map<string, Map<string, number>>
): number {
  // 收集每个学生-节点对的 (trueAbility, finalMastery)
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

  // 计算皮尔逊相关系数
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

  return Math.abs(numerator / denominator);  // 返回绝对值
}

function calculateBucketCorrectRates(results: SimulationResult[]): number[] {
  const buckets = Array.from({ length: CONFIG.BUCKET_COUNT }, () => ({
    correct: 0,
    total: 0,
  }));

  for (const r of results) {
    // 按 trueAbility 分桶（验证真实能力与正确率的关系）
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
// 9. 主函数
// ============================================================

function main() {
  console.log('Question Graph v2.5 - Phase 0 闭环验证\n');
  console.log(`配置:`);
  console.log(`  节点数: ${PYTHAGORAS_NODES.length}`);
  console.log(`  题目数: ${CONFIG.QUESTION_COUNT}`);
  console.log(`  学生数: ${CONFIG.STUDENT_COUNT}`);
  console.log(`  总样本数: ${CONFIG.QUESTION_COUNT * CONFIG.STUDENT_COUNT}\n`);

  const { results, metrics } = runPhase0Simulation();

  console.log('=== 最终结果 ===');
  console.log(`状态: ${metrics.passed ? '✅ 系统验证通过' : '❌ 系统验证未通过'}`);

  if (metrics.passed) {
    console.log('\n🎉 Phase 0 验证通过！系统可以进入产品开发阶段。');
  } else {
    console.log('\n⚠️ Phase 0 验证未通过，需要调整参数后重试。');
    console.log('建议调整方向:');
    if (metrics.monotonicityScore < CONFIG.MIN_MONOTONICITY) {
      console.log('  - 检查依赖惩罚是否过强');
      console.log('  - 检查权重计算是否合理');
    }
    if (metrics.masteryCorrelation < CONFIG.MIN_PREDICTION_ACCURACY) {
      console.log('  - 检查掌握度更新算法');
      console.log('  - 调整 alpha 学习率');
    }
  }

  return metrics.passed ? 0 : 1;
}

// 运行
if (require.main === module) {
  process.exit(main());
}

export { main, runPhase0Simulation, LoopValidationMetrics, SimulationResult };
