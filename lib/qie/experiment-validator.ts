/**
 * 🔬 UOK Experiment Validator
 *
 * 自动化实验验证系统 - 回答"UOK 是否真的优于 baseline"
 *
 * 不做优化，只做验证。
 */

import { prisma } from '@/lib/prisma';
import { UOK } from './uok';

// ========== 实验配置 ==========

const EXPERIMENT_CONFIG = {
  SAMPLE_SIZE: 100, // 每组最少 100 题
  RUNS: 3, // 重复 3 次取稳定性
  MASTERY_TARGET: 0.7, // 目标掌握度
  CALIBRATION_BUCKETS: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
} as const;

// ========== 数据结构 ==========

export interface ExperimentRecord {
  studentId: string;
  questionId: string;
  strategy: Strategy;
  complexity: number;
  predictedProbability: number;
  actualResult: 0 | 1;
  masteryBefore: number;
  masteryAfter: number;
  timestamp: number;
  topic: string;
}

export type Strategy = 'UOK' | 'random' | 'fixed' | 'greedy';

export interface BaselineConfig {
  name: Strategy;
  description: string;
}

// ========== Baseline 定义 ==========

const BASELINES: BaselineConfig[] = [
  { name: 'UOK', description: '最弱知识点 + 复杂度匹配' },
  { name: 'random', description: '完全随机选择' },
  { name: 'fixed', description: '固定中等复杂度 (0.4-0.6)' },
  { name: 'greedy', description: '选择历史正确率最高的题' },
];

// ========== 模拟器 ==========

/**
 * 模拟学生答题（因为不能真让学生做100题）
 * 基于一个简单的学生模型
 */
class StudentSimulator {
  private baseAbility: number; // 0-1，学生基础能力
  private topicAbilities: Map<string, number>; // 每个主题的能力

  constructor(baseAbility: number = 0.5) {
    this.baseAbility = baseAbility;
    this.topicAbilities = new Map([
      ['一元一次方程', 0.4],
      ['一元二次方程', 0.3],
      ['函数', 0.35],
      ['不等式', 0.45],
      ['几何', 0.5],
    ]);
  }

  /**
   * 模拟答题：基于学生能力和题目复杂度
   *
   * 答对概率 = sigmoid(学生能力 - 题目复杂度)
   */
  answer(questionComplexity: number, topic: string): { isCorrect: boolean; trueProbability: number } {
    const topicAbility = this.topicAbilities.get(topic) ?? this.baseAbility;
    const ability = (this.baseAbility + topicAbility) / 2;

    // 复杂度越高，答对概率越低
    const trueProbability = 1 / (1 + Math.exp(5 * (questionComplexity - ability)));

    // 添加一些随机噪声
    const noise = (Math.random() - 0.5) * 0.2;
    const finalProb = Math.max(0, Math.min(1, trueProbability + noise));

    return {
      isCorrect: Math.random() < finalProb,
      trueProbability: finalProb,
    };
  }

  getMastery(topic: string): number {
    return this.topicAbilities.get(topic) ?? this.baseAbility;
  }

  /**
   * 模拟学习：答对后能力提升
   */
  learn(topic: string, isCorrect: boolean): number {
    const current = this.topicAbilities.get(topic) ?? this.baseAbility;
    const change = isCorrect ? 0.03 : -0.01;
    const newValue = Math.max(0, Math.min(1, current + change));
    this.topicAbilities.set(topic, newValue);
    return newValue;
  }
}

// ========== 策略实现 ==========

class StrategyImplementer {
  private uok: UOK;
  private allQuestions: any[] = [];
  private questionHistory: Map<string, number> = new Map(); // questionId -> correct count

  constructor() {
    this.uok = new UOK();
  }

  async loadQuestions() {
    this.allQuestions = await prisma.question.findMany({
      where: {
        extractionStatus: 'SUCCESS',
        complexity: { not: null },
        cognitiveLoad: { not: null },
        reasoningDepth: { not: null },
      },
      select: {
        id: true,
        knowledgePoints: true,
        complexity: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        difficulty: true,
      },
      take: 500, // 获取足够多的题目
    });
  }

  private parseTopics(kp: string | null): string[] {
    if (!kp) return ['unknown'];
    try {
      const parsed = JSON.parse(kp);
      return Array.isArray(parsed) ? parsed : ['unknown'];
    } catch {
      return [kp];
    }
  }

  /**
   * UOK 策略 - 最大化信息增益
   *
   * score(q) = (1 - |P - 0.5|) × max(0, Δcomplexity)
   *
   * - P: ML 预测概率，接近 0.5 时最有信息价值
   * - Δcomplexity: targetComplexity - questionComplexity，只选择能提升的
   */
  async uokStrategy(studentId: string, excludeIds: string[]): Promise<any> {
    const action = this.uok.act('next_question', studentId);

    // 处理 gap_report: 新学生没有历史数据，返回第一个可用题目
    if (action.type === 'gap_report') {
      const candidates = this.allQuestions.filter(q => !excludeIds.includes(q.id));
      if (candidates.length === 0) return null;
      // 选择中等复杂度的题目作为起点
      const mediumComplexity = candidates.filter(q => {
        const c = q.complexity ?? 0.5;
        return c >= 0.4 && c <= 0.6;
      });
      if (mediumComplexity.length > 0) {
        return mediumComplexity[Math.floor(Math.random() * mediumComplexity.length)];
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (action.type === 'done' || action.type === 'error') {
      return null;
    }

    // action.type is now 'recommend' or 'recommend_question', both have topic
    const topic = action.topic;
    const explanation = this.uok.explain({ studentId });
    if (explanation.type !== 'student') {
      return null;
    }

    const mastery = explanation.weakTopics.find(t => t.topic === topic)?.mastery ?? 0.5;
    const targetComplexity = 0.3 + mastery * 0.5;

    // 当前复杂度 = 基于掌握度计算的当前水平
    const currentComplexity = 0.3 + mastery * 0.5;

    // 最大化信息增益评分
    const candidates = this.allQuestions.filter(q => !excludeIds.includes(q.id));
    const scored = candidates.map(q => {
      const complexity = q.complexity ?? 0.5;

      // 获取 ML 预测概率
      let prediction = 0.5;
      try {
        prediction = this.uok.predict(studentId, q.id, {
          difficulty: mastery,
          complexity,
        });
      } catch {
        prediction = 0.5;
      }

      // 信息增益: P 越接近 0.5，信息价值越高
      const informationGain = 1 - Math.abs(prediction - 0.5);

      // 复杂度提升: 只选择能提升复杂度的题目
      // 题目复杂度 - 当前水平 = 提升空间
      const deltaComplexity = Math.max(0, complexity - currentComplexity);

      // 综合评分
      const score = informationGain * deltaComplexity;

      return { question: q, score, informationGain, deltaComplexity, prediction, currentComplexity };
    });

    // 按评分降序排序
    scored.sort((a, b) => b.score - a.score);

    return scored[0]?.question ?? null;
  }

  /**
   * Random 策略
   */
  randomStrategy(excludeIds: string[]): any {
    const candidates = this.allQuestions.filter(q => !excludeIds.includes(q.id));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Fixed 策略 - 固定中等复杂度
   */
  fixedStrategy(excludeIds: string[]): any {
    const candidates = this.allQuestions.filter(q => {
      if (excludeIds.includes(q.id)) return false;
      const c = q.complexity ?? 0.5;
      return c >= 0.4 && c <= 0.6;
    });
    if (candidates.length === 0) return this.randomStrategy(excludeIds);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Greedy 策略 - 选择历史正确率最高的题
   */
  greedyStrategy(excludeIds: string[]): any {
    // 模拟：选择低复杂度的题（通常正确率高）
    const candidates = this.allQuestions.filter(q => {
      if (excludeIds.includes(q.id)) return false;
      return (q.complexity ?? 0.5) < 0.4;
    });
    if (candidates.length === 0) return this.randomStrategy(excludeIds);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * 统一策略接口
   */
  async execute(strategy: Strategy, studentId: string, excludeIds: string[]): Promise<any> {
    switch (strategy) {
      case 'UOK':
        return await this.uokStrategy(studentId, excludeIds);
      case 'random':
        return this.randomStrategy(excludeIds);
      case 'fixed':
        return this.fixedStrategy(excludeIds);
      case 'greedy':
        return this.greedyStrategy(excludeIds);
    }
  }
}

// ========== 实验运行器 ==========

export interface ExperimentResult {
  strategy: Strategy;
  records: ExperimentRecord[];
  metrics: ExperimentMetrics;
}

export interface ExperimentMetrics {
  // 预测能力
  brierScore: number;
  calibration: Map<string, { predicted: number; actual: number }>;

  // 学习效率
  questionsToMastery70: number | null;

  // 复杂度提升
  avgComplexity: number;
  maxComplexity: number;
  complexityGrowth: number; // 最后20题 - 前20题

  // 学生能力提升
  masteryGrowth: number; // masteryAfter 最后 - masteryBefore 最初

  // 基础统计
  accuracy: number;
  totalQuestions: number;
}

class ExperimentRunner {
  private implementer: StrategyImplementer;
  private simulator: StudentSimulator;

  constructor() {
    this.implementer = new StrategyImplementer();
    this.simulator = new StudentSimulator(0.5); // 中等能力学生
  }

  async initialize() {
    await this.implementer.loadQuestions();
  }

  /**
   * 运行单个策略的实验
   */
  async runStrategy(strategy: Strategy, studentId: string, n: number = EXPERIMENT_CONFIG.SAMPLE_SIZE): Promise<ExperimentResult> {
    const records: ExperimentRecord[] = [];
    const excludeIds: string[] = [];

    // 初始化 UOK 学生状态
    if (strategy === 'UOK') {
      await this.implementer['uok'].getOrCreateStudentWithState(studentId);
    }

    for (let i = 0; i < n; i++) {
      // 选择题目
      const question = await this.implementer.execute(strategy, studentId, excludeIds);
      if (!question) break;

      const topics = this.implementer['parseTopics'](question.knowledgePoints);
      const topic = topics[0] ?? 'unknown';
      const complexity = question.complexity ?? 0.5;

      // 获取预测概率
      let predictedProbability = 0.5;
      if (strategy === 'UOK') {
        try {
          predictedProbability = this.implementer['uok'].predict(studentId, question.id, {
            difficulty: 0.5,
            complexity,
          });
        } catch {
          predictedProbability = 0.5;
        }
      } else {
        // baseline: 用复杂度作为预测
        predictedProbability = 1 - complexity;
      }

      // 模拟答题
      const masteryBefore = this.simulator.getMastery(topic);
      const { isCorrect, trueProbability } = this.simulator.answer(complexity, topic);

      // 记录
      records.push({
        studentId,
        questionId: question.id,
        strategy,
        complexity,
        predictedProbability,
        actualResult: isCorrect ? 1 : 0,
        masteryBefore,
        masteryAfter: this.simulator.learn(topic, isCorrect),
        timestamp: Date.now(),
        topic,
      });

      // UOK: 编码答案触发学习
      if (strategy === 'UOK') {
        this.implementer['uok'].encodeQuestion({
          id: question.id,
          content: '',
          topics,
        });
        this.implementer['uok'].encodeAnswer(studentId, question.id, isCorrect);
      }

      excludeIds.push(question.id);
    }

    return {
      strategy,
      records,
      metrics: this.calculateMetrics(records),
    };
  }

  /**
   * 计算指标
   */
  private calculateMetrics(records: ExperimentRecord[]): ExperimentMetrics {
    const n = records.length;
    if (n === 0) {
      return {
        brierScore: 1,
        calibration: new Map(),
        questionsToMastery70: null,
        avgComplexity: 0.5,
        maxComplexity: 0.5,
        complexityGrowth: 0,
        accuracy: 0,
        totalQuestions: 0,
        masteryGrowth: 0,
      };
    }

    // Brier Score
    const brierScore = records.reduce((sum, r) => sum + (r.predictedProbability - r.actualResult) ** 2, 0) / n;

    // Calibration
    const calibration = new Map<string, { predicted: number; actual: number }>();
    const buckets = EXPERIMENT_CONFIG.CALIBRATION_BUCKETS;
    for (let i = 0; i < buckets.length - 1; i++) {
      const lower = buckets[i];
      const upper = buckets[i + 1];

      const bucketRecords = records.filter(r => {
        return r.predictedProbability >= lower && r.predictedProbability < upper;
      });

      if (bucketRecords.length > 0) {
        const avgPredicted = bucketRecords.reduce((s, r) => s + r.predictedProbability, 0) / bucketRecords.length;
        const avgActual = bucketRecords.reduce((s, r) => s + r.actualResult, 0) / bucketRecords.length;
        calibration.set(`${lower.toFixed(1)}-${upper.toFixed(1)}`, {
          predicted: avgPredicted,
          actual: avgActual,
        });
      }
    }

    // 学习效率：达到 mastery 0.7 的题数
    let questionsToMastery70: number | null = null;
    for (let i = 0; i < n; i++) {
      const topicMastery = this.getMasteryAt(records, i, records[i].topic);
      if (topicMastery >= 0.7) {
        questionsToMastery70 = i + 1;
        break;
      }
    }

    // 复杂度分析
    const complexities = records.map(r => r.complexity);
    const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
    const maxComplexity = Math.max(...complexities);

    // 复杂度增长：后20题 - 前20题
    const sliceSize = Math.min(20, Math.floor(n / 2));
    const earlyAvg = complexities.slice(0, sliceSize).reduce((a, b) => a + b, 0) / sliceSize;
    const lateAvg = complexities.slice(-sliceSize).reduce((a, b) => a + b, 0) / sliceSize;
    const complexityGrowth = lateAvg - earlyAvg;

    // 学生能力提升：最后的 masteryAfter - 最初的 masteryBefore
    const initialMastery = records[0]?.masteryBefore ?? 0.5;
    const finalMastery = records[n - 1]?.masteryAfter ?? records[0]?.masteryAfter ?? 0.5;
    const masteryGrowth = finalMastery - initialMastery;

    // 准确率
    const accuracy = records.reduce((s, r) => s + r.actualResult, 0) / n;

    return {
      brierScore,
      calibration,
      questionsToMastery70,
      avgComplexity,
      maxComplexity,
      complexityGrowth,
      masteryGrowth,
      accuracy,
      totalQuestions: n,
    };
  }

  private getMasteryAt(records: ExperimentRecord[], index: number, topic: string): number {
    // 找到该主题的最新掌握度
    for (let i = index; i >= 0; i--) {
      if (records[i].topic === topic) {
        return records[i].masteryAfter;
      }
    }
    return records[0]?.masteryBefore ?? 0.5;
  }
}

// ========== 报告生成器 ==========

export function generateReport(results: Map<Strategy, ExperimentResult[]>): string {
  let report = '\n╔══════════════════════════════════════════════════════════╗\n';
  report += '║           🔬 UOK vs Baseline 实验验证报告                    ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';

  // 计算每个策略的均值
  const averages = new Map<Strategy, ExperimentMetrics>();
  for (const [strategy, runs] of results) {
    const avgMetrics: ExperimentMetrics = {
      brierScore: runs.reduce((s, r) => s + r.metrics.brierScore, 0) / runs.length,
      calibration: runs[0].metrics.calibration, // 简化：取第一次的
      questionsToMastery70: runs.reduce((s, r) => s + (r.metrics.questionsToMastery70 ?? 0), 0) / runs.length,
      avgComplexity: runs.reduce((s, r) => s + r.metrics.avgComplexity, 0) / runs.length,
      maxComplexity: runs.reduce((s, r) => s + r.metrics.maxComplexity, 0) / runs.length,
      complexityGrowth: runs.reduce((s, r) => s + r.metrics.complexityGrowth, 0) / runs.length,
      masteryGrowth: runs.reduce((s, r) => s + r.metrics.masteryGrowth, 0) / runs.length,
      accuracy: runs.reduce((s, r) => s + r.metrics.accuracy, 0) / runs.length,
      totalQuestions: runs[0].metrics.totalQuestions,
    };
    averages.set(strategy, avgMetrics);
  }

  const uok = averages.get('UOK')!;
  const random = averages.get('random')!;
  const fixed = averages.get('fixed')!;
  const greedy = averages.get('greedy')!;

  // 1. 预测能力
  report += '║  1. 预测能力 (Brier Score, 越小越好)                      ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += `║  • UOK:    ${uok.brierScore.toFixed(4).padStart(10)}                           ║\n`;
  report += `║  • Random: ${random.brierScore.toFixed(4).padStart(10)}                           ║\n`;
  report += `║  • Fixed:  ${fixed.brierScore.toFixed(4).padStart(10)}                           ║\n`;
  report += `║  • Greedy: ${greedy.brierScore.toFixed(4).padStart(10)}                           ║\n`;
  const predictionWinner = uok.brierScore < random.brierScore ? 'YES' : 'NO';
  report += `║  → UOK 是否更优: ${predictionWinner.padEnd(3)}                          ║\n`;

  // 2. 学习效率
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += '║  2. 学习效率 (达到 mastery 0.7 所需题数)                 ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += `║  • UOK:    ${(uok.questionsToMastery70 ?? 'N/A').toString().padStart(10)}                          ║\n`;
  report += `║  • Random: ${(random.questionsToMastery70 ?? 'N/A').toString().padStart(10)}                          ║\n`;
  report += `║  • Fixed:  ${(fixed.questionsToMastery70 ?? 'N/A').toString().padStart(10)}                          ║\n`;
  report += `║  • Greedy: ${(greedy.questionsToMastery70 ?? 'N/A').toString().padStart(10)}                          ║\n`;
  const learningWinner = uok.questionsToMastery70 && random.questionsToMastery70
    ? (uok.questionsToMastery70 < random.questionsToMastery70 ? 'YES' : 'NO')
    : 'N/A';
  report += `║  → UOK 是否更快: ${learningWinner.padEnd(3)}                          ║\n`;

  // 3. 学生能力提升
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += '║  3. 学生能力提升 (mastery 增长)                           ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += `║  • UOK:    ${(uok.masteryGrowth * 100).toFixed(1)}%                             ║\n`;
  report += `║  • Random: ${(random.masteryGrowth * 100).toFixed(1)}%                             ║\n`;
  report += `║  • Fixed:  ${(fixed.masteryGrowth * 100).toFixed(1)}%                             ║\n`;
  report += `║  • Greedy: ${(greedy.masteryGrowth * 100).toFixed(1)}%                             ║\n`;
  const masteryWinner = uok.masteryGrowth > random.masteryGrowth ? 'YES' : 'NO';
  report += `║  → UOK 是否更优: ${masteryWinner.padEnd(3)}                          ║\n`;

  // 4. 准确率
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += '║  4. 准确率                                               ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += `║  • UOK:    ${(uok.accuracy * 100).toFixed(1).padStart(6)}%                            ║\n`;
  report += `║  • Random: ${(random.accuracy * 100).toFixed(1).padStart(6)}%                            ║\n`;
  report += `║  • Fixed:  ${(fixed.accuracy * 100).toFixed(1).padStart(6)}%                            ║\n`;
  report += `║  • Greedy: ${(greedy.accuracy * 100).toFixed(1).padStart(6)}%                            ║\n`;

  // 5. 最终结论
  report += '╠══════════════════════════════════════════════════════════╣\n';
  report += '║  5. 最终结论                                             ║\n';
  report += '╠══════════════════════════════════════════════════════════╣\n';

  const scores = {
    prediction: predictionWinner === 'YES' ? 1 : 0,
    learning: learningWinner === 'YES' ? 1 : 0,
    mastery: masteryWinner === 'YES' ? 1 : 0,
  };
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  report += `║  • 预测能力: ${predictionWinner.padEnd(3)} (${scores.prediction}/1)                    ║\n`;
  report += `║  • 学习效率: ${learningWinner === 'N/A' ? 'N/A'.padEnd(3) : learningWinner.padEnd(3)} (${scores.learning}/1)                    ║\n`;
  report += `║  • 能力提升: ${masteryWinner.padEnd(3)} (${scores.mastery}/1)                    ║\n`;
  report += '╠══════════════════════════════════════════════════════════╣\n';

  const finalVerdict = totalScore >= 2 ? 'YES - 有价值' : 'NO - 无价值';
  report += `║                                                          ║\n`;
  report += `║  🎯 最终结论: ${finalVerdict.padEnd(15)}                   ║\n`;
  report += `║                                                          ║\n`;

  if (totalScore >= 2) {
    report += '║  建议: 继续投入 UOK，显著优于 baseline                   ║\n';
  } else {
    report += '║  建议: UOK 未显示出明显优势，需要重新评估             ║\n';
  }

  report += '╚══════════════════════════════════════════════════════════╝\n';

  return report;
}

// ========== 主入口 ==========

/**
 * 运行完整实验验证
 */
export async function runExperimentValidation(): Promise<{
  report: string;
  data: Map<Strategy, ExperimentResult[]>;
  exportData: ExperimentRecord[];
}> {
  console.log('🔬 开始实验验证...');

  const runner = new ExperimentRunner();
  await runner.initialize();

  const results = new Map<Strategy, ExperimentResult[]>();
  const allRecords: ExperimentRecord[] = [];

  // 对每个策略运行多次
  for (const strategy of BASELINES) {
    const runs: ExperimentResult[] = [];

    for (let i = 0; i < EXPERIMENT_CONFIG.RUNS; i++) {
      console.log(`  运行 ${strategy.name} (第 ${i + 1}/${EXPERIMENT_CONFIG.RUNS} 次)...`);
      const studentId = `sim_student_${strategy.name}_${i}`;
      const result = await runner.runStrategy(strategy.name, studentId);
      runs.push(result);
      allRecords.push(...result.records);
    }

    results.set(strategy.name, runs);
  }

  const report = generateReport(results);

  console.log(report);

  return {
    report,
    data: results,
    exportData: allRecords,
  };
}

// ========== 数据导出 ==========

/**
 * 导出为 CSV
 */
export function exportToCSV(records: ExperimentRecord[]): string {
  const headers = ['studentId', 'questionId', 'strategy', 'complexity', 'predictedProbability', 'actualResult', 'masteryBefore', 'masteryAfter', 'timestamp', 'topic'];
  const rows = records.map(r => [
    r.studentId,
    r.questionId,
    r.strategy,
    r.complexity.toFixed(4),
    r.predictedProbability.toFixed(4),
    r.actualResult,
    r.masteryBefore.toFixed(4),
    r.masteryAfter.toFixed(4),
    r.timestamp,
    r.topic,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * 导出为 JSON
 */
export function exportToJSON(records: ExperimentRecord[]): string {
  return JSON.stringify(records, null, 2);
}
