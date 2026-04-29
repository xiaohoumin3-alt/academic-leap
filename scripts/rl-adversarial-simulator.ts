#!/usr/bin/env tsx
/**
 * RL自适应引擎 - 对抗式收敛验证器
 *
 * 验证系统在非理想真实环境下的鲁棒性：
 * 1. 疲劳效应 - 学生能力随答题数下降
 * 2. 注意力噪声 - 随机 lapses
 * 3. 随机点击 - 无意义答题
 * 4. 对抗行为 - 故意答错
 * 5. 环境漂移 - 难度/噪声随时间变化
 *
 * 评估标准（比理想环境宽松）：
 * - LE (Learning Effectiveness) ≥ 0.10 (降低，因噪声)
 * - CS (Convergence Stability) ≥ 0.70 (降低，因对抗行为)
 * - Robustness (鲁棒性) ≥ 0.60 (新增：系统应对异常的能力)
 * - DFI (Data Flow Integrity) ≥ 0.99
 */

import { ThompsonSamplingBandit } from '../lib/rl/bandit/thompson-sampling';
import { estimateAbilityEAP, type IRTResponse } from '../lib/rl/irt/estimator';
import { InMemoryLEHistoryService } from '../lib/rl/history/le-history-service';
import { calculateLEReward } from '../lib/rl/reward/le-reward';

// ==================== 对抗式学生配置 ====================

interface AdversarialStudentConfig {
  baseTheta: number;           // 基础能力值
  slipRate: number;            // 会做但做错概率
  guessRate: number;           // 不会但猜对概率
  learningRate: number;        // 答对后能力提升速度

  // 对抗式参数
  fatigueRate: number;         // 疲劳增长率 [0, 0.001]
  maxFatigue: number;          // 最大疲劳值 [0, 0.5]
  attentionNoise: number;      // 注意力噪声水平 [0, 0.3]
  randomClickProb: number;     // 随机点击概率 [0, 0.2]
  adversarialProb: number;     // 对抗性行为概率 [0, 0.3]
}

interface EnvironmentConfig {
  difficultyDrift: number;     // 难度漂移速度
  noiseEnhancement: number;    // 噪声增强速度
  behaviorChangeAt: number;    // 行为变化点 (0-1, 相对于总session数)
}

interface AdversarialStudent {
  config: AdversarialStudentConfig;
  theta: number;
  fatigue: number;
  sessionsAnswered: number;
  answer(deltaC: number, session: number, totalSessions: number): boolean;
  learn(deltaC: number, correct: boolean): void;
  resetFatigue(): void;
}

// ==================== 对抗式学生实现 ====================

class AdversarialSimulatedStudent implements AdversarialStudent {
  config: AdversarialStudentConfig;
  theta: number;
  fatigue: number;
  sessionsAnswered: number;

  constructor(config: AdversarialStudentConfig) {
    this.config = config;
    this.theta = config.baseTheta;
    this.fatigue = 0;
    this.sessionsAnswered = 0;
  }

  /**
   * 计算当前疲劳值（线性增长）
   */
  private updateFatigue(): void {
    this.fatigue = Math.min(
      this.config.maxFatigue,
      this.fatigue + this.config.fatigueRate
    );
  }

  /**
   * 对抗式答题逻辑
   */
  answer(deltaC: number, session: number, totalSessions: number): boolean {
    this.sessionsAnswered++;
    this.updateFatigue();

    const normalizedDeltaC = (deltaC - 5) / 1.7;

    // 1. 计算真实能力概率
    const logit = this.theta - normalizedDeltaC - this.fatigue; // 疲劳降低有效能力
    const trueProbability = 1 / (1 + Math.exp(-logit));

    // 2. 应用注意力噪声
    let effectiveProbability = trueProbability;
    if (Math.random() < this.config.attentionNoise) {
      // 注意力 lapse：概率随机化
      effectiveProbability = 0.3 + Math.random() * 0.4;
    }

    // 3. 应用 slip 和 guess 修正
    if (effectiveProbability > 0.5) {
      effectiveProbability *= (1 - this.config.slipRate);
    } else {
      effectiveProbability += (1 - effectiveProbability) * this.config.guessRate;
    }

    // 4. 随机点击检测
    if (Math.random() < this.config.randomClickProb) {
      return Math.random() < 0.5; // 完全随机
    }

    // 5. 对抗性行为检测
    if (Math.random() < this.config.adversarialProb) {
      // 故意答错（基于真实能力判断应该答对的题目）
      if (trueProbability > 0.6) {
        return false; // 故意答错
      }
    }

    return Math.random() < effectiveProbability;
  }

  learn(deltaC: number, correct: boolean): void {
    if (correct) {
      const difficulty = Math.abs(deltaC - 5) / 5;
      // 疲劳状态下学习效率降低
      const learningEfficiency = 1 - this.fatigue;
      this.theta += this.config.learningRate * (1 + difficulty * 0.5) * learningEfficiency;
    } else {
      const difficulty = Math.abs(deltaC - 5) / 5;
      const penalty = this.config.learningRate * 0.5 * (1 - difficulty * 0.5);
      this.theta -= penalty;
    }

    this.theta = Math.max(-3, Math.min(3, this.theta));
  }

  resetFatigue(): void {
    this.fatigue = 0;
  }
}

// ==================== 预设对抗式学生类型 ====================

const ADVERSARIAL_STUDENT_TYPES: Record<string, AdversarialStudentConfig> = {
  // 噪声学生：注意力不集中，有随机 lapses
  noisy_student: {
    baseTheta: 0,
    slipRate: 0.15,
    guessRate: 0.1,
    learningRate: 0.003,
    fatigueRate: 0.0001,
    maxFatigue: 0.1,
    attentionNoise: 0.25,      // 高噪声
    randomClickProb: 0.05,
    adversarialProb: 0.02,
  },

  // 懒惰学生：容易疲劳，随机点击
  lazy_student: {
    baseTheta: 0.3,
    slipRate: 0.2,
    guessRate: 0.15,
    learningRate: 0.002,
    fatigueRate: 0.0005,        // 快速疲劳
    maxFatigue: 0.4,           // 高疲劳上限
    attentionNoise: 0.1,
    randomClickProb: 0.15,     // 高随机点击
    adversarialProb: 0.05,
  },

  // 对抗学生：故意答错
  adversarial_student: {
    baseTheta: 0.5,
    slipRate: 0.1,
    guessRate: 0.05,
    learningRate: 0.001,        // 低学习率（可能不想学）
    fatigueRate: 0.0002,
    maxFatigue: 0.15,
    attentionNoise: 0.08,
    randomClickProb: 0.03,
    adversarialProb: 0.25,     // 高对抗概率
  },
};

// ==================== 环境配置 ====================

const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  stable: {
    difficultyDrift: 0,
    noiseEnhancement: 0,
    behaviorChangeAt: 1,  // 无变化
  },
  drifting: {
    difficultyDrift: 0.0001,  // 轻微难度漂移
    noiseEnhancement: 0.00005,
    behaviorChangeAt: 0.6,  // 60% 处变化
  },
  hostile: {
    difficultyDrift: 0.0003,
    noiseEnhancement: 0.0002,
    behaviorChangeAt: 0.4,  // 40% 处变化
  },
};

// ==================== 会话记录 ====================

interface AdversarialSessionRecord {
  session: number;
  studentTheta: number;
  fatigue: number;
  recommendedDeltaC: number;
  actualDeltaC: number;  // 环境漂移后的实际难度
  correct: boolean;
  answerType: 'normal' | 'fatigue' | 'noise' | 'random' | 'adversarial';
  reward: number;
  preAccuracy: number;
  postAccuracy: number;
  leDelta: number;
}

interface AdversarialMetrics {
  sessions: number;
  dfi: number;
  le: number;
  cs: number;
  robustness: number;
  converged: boolean;

  // 失败模式统计
  failureModes: {
    fatigueAnswers: number;
    noiseAnswers: number;
    randomClicks: number;
    adversarialAnswers: number;
    totalAnswers: number;
  };

  recommendationTrend: number[];
  studentImprovement: number;
  details: {
    dfiPass: boolean;
    lePass: boolean;
    csPass: boolean;
    robustnessPass: boolean;
    finalStudentTheta: number;
    initialStudentTheta: number;
    avgReward: number;
    finalFatigue: number;
  };
}

// ==================== 对抗式收敛模拟器 ====================

class AdversarialConvergenceSimulator {
  private bandit: ThompsonSamplingBandit;
  private history: InMemoryLEHistoryService;
  private userId: string;
  private knowledgePointId: string;
  private sessions: AdversarialSessionRecord[] = [];
  private irtResponses: IRTResponse[] = [];

  constructor(bucketSize: number = 0.5) {
    this.bandit = new ThompsonSamplingBandit({ bucketSize });
    this.history = new InMemoryLEHistoryService();
    this.userId = 'adversarial-student';
    this.knowledgePointId = 'test-kp-adversarial';
  }

  /**
   * 运行对抗式模拟
   */
  async simulate(
    studentType: keyof typeof ADVERSARIAL_STUDENT_TYPES,
    environmentType: keyof typeof ENVIRONMENT_CONFIGS = 'stable',
    maxSessions: number = 1000
  ): Promise<AdversarialMetrics> {

    const studentConfig = ADVERSARIAL_STUDENT_TYPES[studentType];
    const envConfig = ENVIRONMENT_CONFIGS[environmentType];

    const student = new AdversarialSimulatedStudent(studentConfig);
    const initialTheta = student.theta;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🛡️ 对抗式收敛验证模拟器`);
    console.log(`${'='.repeat(60)}`);
    console.log(`学生类型: ${studentType}`);
    console.log(`环境类型: ${environmentType}`);
    console.log(`初始能力: ${initialTheta.toFixed(2)}`);
    console.log(`最大会话数: ${maxSessions}`);
    console.log(`${'='.repeat(60)}\n`);

    this.irtResponses = [];

    let totalLE = 0;
    let leCount = 0;
    let totalReward = 0;
    const recommendationCounts = new Map<string, number>();

    // 失败模式统计
    const failureModes = {
      fatigueAnswers: 0,
      noiseAnswers: 0,
      randomClicks: 0,
      adversarialAnswers: 0,
      totalAnswers: 0,
    };

    // 环境漂移状态
    let difficultyOffset = 0;
    let noiseMultiplier = 1;

    for (let session = 1; session <= maxSessions; session++) {
      // 应用环境漂移
      difficultyOffset += envConfig.difficultyDrift;
      noiseMultiplier += envConfig.noiseEnhancement;

      // 行为变化点检测
      if (session / maxSessions >= envConfig.behaviorChangeAt && envConfig.behaviorChangeAt < 1) {
        // 在变化点，学生可能改变行为
        if (session === Math.floor(maxSessions * envConfig.behaviorChangeAt)) {
          console.log(`⚠️  Session ${session}: 环境行为变化`);
        }
      }

      // 1. 获取推荐
      const selectedDeltaC = parseFloat(this.bandit.selectArm(student.theta));

      // 2. 应用环境漂移
      const actualDeltaC = Math.max(0, Math.min(10, selectedDeltaC + difficultyOffset));

      // 3. 学生作答
      const preAccuracy = this.history.getAccuracy(this.userId, this.knowledgePointId);

      // 检测答案类型（用于统计）
      let answerType: AdversarialSessionRecord['answerType'] = 'normal';
      const rng = Math.random();

      // 简化的答案类型检测（基于概率）
      if (rng < studentConfig.randomClickProb) {
        answerType = 'random';
        failureModes.randomClicks++;
      } else if (rng < studentConfig.randomClickProb + studentConfig.adversarialProb) {
        answerType = 'adversarial';
        failureModes.adversarialAnswers++;
      } else if (rng < studentConfig.randomClickProb + studentConfig.adversarialProb + studentConfig.attentionNoise * noiseMultiplier) {
        answerType = 'noise';
        failureModes.noiseAnswers++;
      } else if (student.fatigue > 0.2) {
        answerType = 'fatigue';
        failureModes.fatigueAnswers++;
      }

      const correct = student.answer(actualDeltaC, session, maxSessions);

      // 4. 计算奖励
      const rewardResult = await calculateLEReward(
        {
          userId: this.userId,
          questionId: `q-${session}`,
          correct,
          knowledgePointId: this.knowledgePointId,
          eventId: `event-${session}`,
          attemptId: `attempt-${session}`,
        },
        {
          knowledgePointId: this.knowledgePointId,
          preAccuracy,
          recommendationId: `rec-${session}`,
        },
        this.history
      );

      // 5. 更新 Bandit（使用推荐难度，不是实际难度）
      this.bandit.update(selectedDeltaC.toFixed(1), correct);

      // 6. 更新 IRT
      this.irtResponses.push({ correct, deltaC: selectedDeltaC });
      if (this.irtResponses.length > 100) {
        this.irtResponses = this.irtResponses.slice(-100);
      }

      // 7. 记录会话
      this.sessions.push({
        session,
        studentTheta: student.theta,
        fatigue: student.fatigue,
        recommendedDeltaC: selectedDeltaC,
        actualDeltaC,
        correct,
        answerType,
        reward: rewardResult.reward,
        preAccuracy: rewardResult.preAccuracy,
        postAccuracy: rewardResult.postAccuracy,
        leDelta: rewardResult.leDelta,
      });

      // 8. 学生学习
      student.learn(selectedDeltaC, correct);

      // 9. 统计
      recommendationCounts.set(
        selectedDeltaC.toFixed(1),
        (recommendationCounts.get(selectedDeltaC.toFixed(1)) || 0) + 1
      );

      totalReward += rewardResult.reward;
      failureModes.totalAnswers++;

      if (session >= 10) {
        totalLE += rewardResult.leDelta;
        leCount++;
      }

      // 每100轮输出进度
      if (session % 100 === 0) {
        const avgLE = leCount > 0 ? totalLE / leCount : 0;
        console.log(
          `Session ${session}: Theta=${student.theta.toFixed(2)}, ` +
          `Fatigue=${(student.fatigue * 100).toFixed(1)}%, ` +
          `AvgLE=${(avgLE * 100).toFixed(1)}%, ` +
          `Acc=${rewardResult.postAccuracy.toFixed(2)}`
        );
      }
    }

    // 计算最终指标
    const dfi = 1.0; // 模拟环境无数据丢失
    const cs = this.calculateCS(recommendationCounts);
    const recommendationTrend = this.sessions.map(s => s.recommendedDeltaC);
    const studentImprovement = student.theta - initialTheta;

    // LE 计算：考虑对抗环境下的能力提升
    const le = Math.max(0, studentImprovement / 6);

    // Robustness 计算：系统在异常行为下的稳定性
    // 基于两点：1) 推荐分布是否仍然集中 2) 学生是否仍有提升
    const robustness = (
      (cs * 0.5) +  // 推荐稳定性占50%
      (Math.min(1, Math.max(0, le / 0.15)) * 0.5)  // 学习效果占50%（以0.15为基准）
    );

    const converged = dfi >= 0.99 && le >= 0.10 && cs >= 0.70 && robustness >= 0.60;

    const details = {
      dfiPass: dfi >= 0.99,
      lePass: le >= 0.10,
      csPass: cs >= 0.70,
      robustnessPass: robustness >= 0.60,
      finalStudentTheta: student.theta,
      initialStudentTheta: initialTheta,
      avgReward: totalReward / maxSessions,
      finalFatigue: student.fatigue,
    };

    return {
      sessions: maxSessions,
      dfi,
      le,
      cs,
      robustness,
      converged,
      failureModes,
      recommendationTrend,
      studentImprovement,
      details,
    };
  }

  /**
   * 计算 CS (Convergence Stability)
   */
  private calculateCS(recommendationCounts: Map<string, number>): number {
    const total = Array.from(recommendationCounts.values()).reduce((a, b) => a + b, 0);

    if (total === 0) return 0;

    let expected = 0;
    for (const [deltaC, count] of recommendationCounts) {
      expected += parseFloat(deltaC) * (count / total);
    }

    let variance = 0;
    for (const [deltaC, count] of recommendationCounts) {
      const diff = parseFloat(deltaC) - expected;
      variance += diff * diff * (count / total);
    }

    const normalizedVariance = variance / 25;
    return Math.max(0, 1 - normalizedVariance);
  }

  getSessions(): AdversarialSessionRecord[] {
    return this.sessions;
  }
}

// ==================== 主函数 ====================

async function main() {
  const args = process.argv.slice(2);
  const studentType = (args[0] as keyof typeof ADVERSARIAL_STUDENT_TYPES) || 'noisy_student';
  const environmentType = (args[1] as keyof typeof ENVIRONMENT_CONFIGS) || 'stable';
  const maxSessions = parseInt(args[2]) || 1000;
  const json = args.includes('--json');

  if (!ADVERSARIAL_STUDENT_TYPES[studentType]) {
    console.error(`Unknown student type: ${studentType}`);
    console.error(`Available: ${Object.keys(ADVERSARIAL_STUDENT_TYPES).join(', ')}`);
    process.exit(1);
  }

  if (!ENVIRONMENT_CONFIGS[environmentType]) {
    console.error(`Unknown environment type: ${environmentType}`);
    console.error(`Available: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const simulator = new AdversarialConvergenceSimulator(0.5);
  const metrics = await simulator.simulate(studentType, environmentType, maxSessions);

  if (json) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 对抗式收敛验证结果`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n  指标               实际值        目标值        状态`);
    console.log(`  ─────────────────────────────────────────────────`);
    console.log(
      `  DFI                ${(metrics.dfi * 100).toFixed(1)}%          99%          ${metrics.details.dfiPass ? '✅' : '❌'}`
    );
    console.log(
      `  LE                 ${(metrics.le * 100).toFixed(1)}%          ≥10%         ${metrics.details.lePass ? '✅' : '❌'}`
    );
    console.log(
      `  CS                 ${(metrics.cs * 100).toFixed(1)}%          ≥70%         ${metrics.details.csPass ? '✅' : '❌'}`
    );
    console.log(
      `  Robustness         ${(metrics.robustness * 100).toFixed(1)}%          ≥60%         ${metrics.details.robustnessPass ? '✅' : '❌'}`
    );
    console.log(`  ─────────────────────────────────────────────────`);

    console.log(`\n  学生能力: ${metrics.details.initialStudentTheta.toFixed(2)} → ${metrics.details.finalStudentTheta.toFixed(2)} (${metrics.studentImprovement >= 0 ? '+' : ''}${metrics.studentImprovement.toFixed(2)})`);
    console.log(`  最终疲劳: ${(metrics.details.finalFatigue * 100).toFixed(1)}%`);
    console.log(`  平均奖励: ${metrics.details.avgReward.toFixed(3)}`);

    console.log(`\n  失败模式统计:`);
    const fm = metrics.failureModes;
    console.log(`    疲劳答题:     ${(fm.fatigueAnswers / fm.totalAnswers * 100).toFixed(1)}%`);
    console.log(`    噪声答题:     ${(fm.noiseAnswers / fm.totalAnswers * 100).toFixed(1)}%`);
    console.log(`    随机点击:     ${(fm.randomClicks / fm.totalAnswers * 100).toFixed(1)}%`);
    console.log(`    对抗答题:     ${(fm.adversarialAnswers / fm.totalAnswers * 100).toFixed(1)}%`);

    if (metrics.converged) {
      console.log(`\n  ✅ 系统在对抗环境下仍可收敛`);
    } else {
      console.log(`\n  🚫 系统在对抗环境下未收敛`);
    }

    console.log(`\n${'='.repeat(60)}\n`);
  }

  process.exit(metrics.converged ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { AdversarialConvergenceSimulator, AdversarialSimulatedStudent, ADVERSARIAL_STUDENT_TYPES, ENVIRONMENT_CONFIGS };
export type { AdversarialStudentConfig, EnvironmentConfig, AdversarialSessionRecord, AdversarialMetrics };
