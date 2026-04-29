#!/usr/bin/env tsx
/**
 * RL自适应引擎 - 破坏性验证器
 *
 * ⚠️ 核心原则：不是证明系统可用，而是找出系统会在哪里崩溃
 *
 * 目标：找出系统的结构性失败边界
 * - 哪些设计假设是错误的？
 * - 哪些输入会导致策略崩溃？
 * - 系统是否存在"虚假稳定"？
 *
 * 5类破坏环境：
 * 1. Label Chaos (标签混乱) - 正确答案随机翻转
 * 2. Feedback Delay (反馈延迟) - reward 延迟/丢失
 * 3. Feature Poisoning (特征污染) - ID错配/难度漂移
 * 4. Strategic Attacks (策略攻击) - 越错越强/永不学习
 * 5. Distribution Shift (分布崩塌) - 训练/测试不一致
 */

import { ThompsonSamplingBandit } from '../lib/rl/bandit/thompson-sampling';
import { estimateAbilityEAP, type IRTResponse } from '../lib/rl/irt/estimator';
import { InMemoryLEHistoryService } from '../lib/rl/history/le-history-service';
import { calculateLEReward } from '../lib/rl/reward/le-reward';

// ==================== 破坏环境配置 ====================

interface DestructionEnvironmentConfig {
  name: string;
  description: string;
  params: Record<string, number | string | boolean>;
}

interface LabelChaosConfig extends DestructionEnvironmentConfig {
  type: 'label_chaos';
  params: {
    flipRate: number;           // 答案翻转率 [0, 0.5]
    inconsistencyRate: number;  // 同一题多次答案不一致率 [0, 0.3]
    randomDifficulty: boolean;  // deltaC与真实能力无关
  };
}

interface FeedbackDelayConfig extends DestructionEnvironmentConfig {
  type: 'feedback_delay';
  params: {
    delaySteps: number;         // 延迟步数 [0, 100]
    lossRate: number;           // reward丢失率 [0, 0.5]
    stochasticDelay: boolean;   // 随机延迟
  };
}

interface FeaturePoisoningConfig extends DestructionEnvironmentConfig {
  type: 'feature_poisoning';
  params: {
    knowledgePointMismatchRate: number;  // 知识点错配率 [0, 0.5]
    deltaCDriftSpeed: number;            // 难度漂移速度 [0, 0.01]
    thetaNoise: number;                  // 能力估计噪声 [0, 1]
  };
}

interface DistributionShiftConfig extends DestructionEnvironmentConfig {
  type: 'distribution_shift';
  params: {
    shiftPoint: number;          // 分布变化点 (0-1)
    shiftType: 'easy_to_hard' | 'hard_to_easy' | 'reverse';
    driftSeverity: number;       // 漂移严重程度 [0, 1]
  };
}

type DestructionConfig = LabelChaosConfig | FeedbackDelayConfig | FeaturePoisoningConfig | DistributionShiftConfig;

// ==================== 策略攻击学生配置 ====================

interface StrategicStudentConfig {
  name: string;
  description: string;
  baseTheta: number;
  slipRate: number;
  guessRate: number;
  learningRate: number;
  strategy: StrategicBehavior;
}

type StrategicBehavior =
  | 'inverse_learner'      // 越错越强
  | 'stubborn_learner'     // 永不更新theta
  | 'random_strategist'    // 策略随机切换
  | 'overconfident'        // 高估自己能力
  | 'oscillating';         // 能力剧烈震荡

// ==================== 失败类型 ====================

type FailureType =
  | 'label_noise_failure'      // 标签不一致导致崩溃
  | 'delayed_feedback_failure' // 延迟反馈导致策略失效
  | 'representation_break'     // 特征表示崩溃
  | 'policy_instability'       // 策略不稳定
  | 'distribution_shift_failure' // 分布偏移导致失效
  | 'none';                    // 系统稳定

// ==================== 破坏性指标 ====================

interface DestructionMetrics {
  environment: string;
  sessions: number;
  stability: number;           // CS - 收敛稳定性
  learning_effect: number;     // LE - 学习有效性
  reward_variance: number;     // RV - 奖励方差
  collapse_point: number | null;  // 崩溃点 (null表示未崩溃)
  failure_type: FailureType;
  converged: boolean;

  // 详细分析
  analysis: {
    initial_theta: number;
    final_theta: number;
    theta_trajectory: number[];
    recommendation_distribution: Map<string, number>;
    reward_history: number[];
    collapse_detected: boolean;
    collapse_reason: string;
    pseudo_convergence: boolean;  // 伪收敛（指标好看但无意义）
  };
}

// ==================== 破坏性模拟器 ====================

class DestructionSimulator {
  private bandit: ThompsonSamplingBandit;
  private history: InMemoryLEHistoryService;
  private userId: string;
  private knowledgePointId: string;

  constructor(bucketSize: number = 0.5) {
    this.bandit = new ThompsonSamplingBandit({ bucketSize });
    this.history = new InMemoryLEHistoryService();
    this.userId = 'destruction-test';
    this.knowledgePointId = 'test-kp-destruction';
  }

  /**
   * 运行破坏性测试
   */
  async destruct(
    envConfig: DestructionConfig,
    studentConfig: StrategicStudentConfig,
    maxSessions: number = 1000
  ): Promise<DestructionMetrics> {

    console.log(`\n${'='.repeat(60)}`);
    console.log(`💥 破坏性验证器 - ${envConfig.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`环境: ${envConfig.description}`);
    console.log(`学生: ${studentConfig.name} - ${studentConfig.description}`);
    console.log(`最大会话数: ${maxSessions}`);
    console.log(`${'='.repeat(60)}\n`);

    // 初始化状态
    let theta = studentConfig.baseTheta;
    const initialTheta = theta;
    const thetaTrajectory: number[] = [];
    const rewardHistory: number[] = [];
    const recommendationDistribution = new Map<string, number>();
    const irtResponses: IRTResponse[] = [];

    // 延迟反馈队列
    const delayedRewards: Array<{ step: number; deltaC: string; correct: boolean }> = [];

    // 标签混乱状态
    const labelFlipMap = new Map<number, boolean>(); // questionId -> flipped

    // 分布偏移状态
    let distributionShifted = false;
    let distributionShiftPoint = Math.floor(maxSessions * (envConfig.type === 'distribution_shift'
      ? (envConfig.params as DistributionShiftConfig['params']).shiftPoint
      : 1));

    // 崩溃检测
    let collapsePoint: number | null = null;
    let collapseReason = '';
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 50; // 连续失败阈值

    let totalLE = 0;
    let leCount = 0;
    let totalReward = 0;
    let rewardSum = 0;
    let rewardSquaredSum = 0;

    for (let session = 1; session <= maxSessions; session++) {
      // 检测分布偏移
      if (envConfig.type === 'distribution_shift' && session >= distributionShiftPoint && !distributionShifted) {
        distributionShifted = true;
        console.log(`⚠️  Session ${session}: 分布偏移发生`);
      }

      // 1. 获取推荐
      const recommendedDeltaC = parseFloat(this.bandit.selectArm(theta));

      // 2. 应用环境破坏
      let actualDeltaC = recommendedDeltaC;
      let effectiveTheta = theta;

      // 特征污染：难度漂移
      if (envConfig.type === 'feature_poisoning') {
        const driftSpeed = (envConfig.params as FeaturePoisoningConfig['params']).deltaCDriftSpeed;
        const drift = (session - 1) * driftSpeed * 10;
        actualDeltaC = Math.max(0, Math.min(10, recommendedDeltaC + drift));
      }

      // 分布偏移：难度突变
      if (envConfig.type === 'distribution_shift' && distributionShifted) {
        const shiftType = (envConfig.params as DistributionShiftConfig['params']).shiftType;
        const severity = (envConfig.params as DistributionShiftConfig['params']).driftSeverity;
        if (shiftType === 'easy_to_hard') {
          actualDeltaC = Math.min(10, recommendedDeltaC + severity * 5);
        } else if (shiftType === 'hard_to_easy') {
          actualDeltaC = Math.max(0, recommendedDeltaC - severity * 5);
        } else if (shiftType === 'reverse') {
          actualDeltaC = 10 - recommendedDeltaC;
        }
      }

      // 特征污染：能力估计噪声
      if (envConfig.type === 'feature_poisoning') {
        const thetaNoise = (envConfig.params as FeaturePoisoningConfig['params']).thetaNoise;
        effectiveTheta = theta + (Math.random() - 0.5) * thetaNoise * 2;
      }

      // 3. 学生作答（应用策略行为）
      const normalizedDeltaC = (actualDeltaC - 5) / 1.7;
      let logit = effectiveTheta - normalizedDeltaC;

      // 策略行为修正
      let correctProbability = 1 / (1 + Math.exp(-logit));
      let answerCorrect: boolean;

      switch (studentConfig.strategy) {
        case 'inverse_learner':
          // 越错越强：theta越低，答对概率反而越高
          const inverseTheta = -effectiveTheta;
          const inverseLogit = inverseTheta - normalizedDeltaC;
          correctProbability = 1 / (1 + Math.exp(-inverseLogit));
          answerCorrect = Math.random() < correctProbability;
          // 学习时反向更新
          theta -= answerCorrect ? studentConfig.learningRate : -studentConfig.learningRate * 0.5;
          break;

        case 'stubborn_learner':
          // 永不更新theta
          answerCorrect = Math.random() < correctProbability;
          // 不更新theta
          break;

        case 'random_strategist':
          // 策略随机切换
          const strategy = Math.random();
          if (strategy < 0.33) {
            // 正常答题
            answerCorrect = Math.random() < correctProbability;
            theta += answerCorrect ? studentConfig.learningRate : -studentConfig.learningRate * 0.5;
          } else if (strategy < 0.66) {
            // 总是答对
            answerCorrect = true;
            theta += studentConfig.learningRate;
          } else {
            // 总是答错
            answerCorrect = false;
            theta -= studentConfig.learningRate * 0.5;
          }
          break;

        case 'overconfident':
          // 高估自己：答题概率基于 theta + 1
          const overconfidentLogit = (effectiveTheta + 1) - normalizedDeltaC;
          const overconfidentProb = 1 / (1 + Math.exp(-overconfidentLogit));
          answerCorrect = Math.random() < overconfidentProb;
          theta += answerCorrect ? studentConfig.learningRate * 2 : -studentConfig.learningRate;
          break;

        case 'oscillating':
          // 能力剧烈震荡
          const oscillation = Math.sin(session / 50) * 2;
          const oscillatingLogit = (effectiveTheta + oscillation) - normalizedDeltaC;
          const oscillatingProb = 1 / (1 + Math.exp(-oscillatingLogit));
          answerCorrect = Math.random() < oscillatingProb;
          theta += (Math.random() - 0.5) * studentConfig.learningRate * 4;
          break;

        default:
          answerCorrect = Math.random() < correctProbability;
          theta += answerCorrect ? studentConfig.learningRate : -studentConfig.learningRate * 0.5;
      }

      // 应用slip和guess
      if (answerCorrect && Math.random() < studentConfig.slipRate) {
        answerCorrect = false;
      } else if (!answerCorrect && Math.random() < studentConfig.guessRate) {
        answerCorrect = true;
      }

      // 4. 标签混乱：答案翻转
      if (envConfig.type === 'label_chaos') {
        const flipRate = (envConfig.params as LabelChaosConfig['params']).flipRate;
        const inconsistencyRate = (envConfig.params as LabelChaosConfig['params']).inconsistencyRate;

        // 检查是否需要翻转
        let shouldFlip = Math.random() < flipRate;

        // 不一致性：同一题多次答案不同
        if (Math.random() < inconsistencyRate) {
          const previousFlip = labelFlipMap.get(session);
          shouldFlip = previousFlip === undefined ? !shouldFlip : previousFlip;
        }

        labelFlipMap.set(session, shouldFlip);

        if (shouldFlip) {
          answerCorrect = !answerCorrect;
        }
      }

      // 5. 计算奖励
      const preAccuracy = this.history.getAccuracy(this.userId, this.knowledgePointId);
      const rewardResult = await calculateLEReward(
        {
          userId: this.userId,
          questionId: `q-${session}`,
          correct: answerCorrect,
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

      const reward = rewardResult.reward;

      // 6. 反馈延迟处理
      if (envConfig.type === 'feedback_delay') {
        const delaySteps = (envConfig.params as FeedbackDelayConfig['params']).delaySteps;
        const lossRate = (envConfig.params as FeedbackDelayConfig['params']).lossRate;
        const stochasticDelay = (envConfig.params as FeedbackDelayConfig['params']).stochasticDelay;

        // 检查reward丢失
        if (Math.random() < lossRate) {
          // reward丢失，不更新bandit
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures && collapsePoint === null) {
            collapsePoint = session;
            collapseReason = 'reward_loss_cascade';
          }
        } else {
          // 计算实际延迟
          const actualDelay = stochasticDelay
            ? Math.floor(delaySteps * (0.5 + Math.random()))
            : delaySteps;

          if (actualDelay === 0) {
            // 立即更新
            this.bandit.update(recommendedDeltaC.toFixed(1), answerCorrect);
          } else {
            // 加入延迟队列
            delayedRewards.push({ step: session, deltaC: recommendedDeltaC.toFixed(1), correct: answerCorrect });
          }

          // 处理到期的延迟奖励
          while (delayedRewards.length > 0 && delayedRewards[0].step <= session - actualDelay) {
            const delayed = delayedRewards.shift()!;
            this.bandit.update(delayed.deltaC, delayed.correct);
          }
        }
      } else {
        // 正常更新bandit
        this.bandit.update(recommendedDeltaC.toFixed(1), answerCorrect);
      }

      // 7. 更新IRT
      irtResponses.push({ correct: answerCorrect, deltaC: recommendedDeltaC });
      if (irtResponses.length > 100) {
        irtResponses.splice(0, 1);
      }

      // 8. 记录统计
      theta = Math.max(-3, Math.min(3, theta));
      thetaTrajectory.push(theta);
      rewardHistory.push(reward);

      recommendationDistribution.set(
        recommendedDeltaC.toFixed(1),
        (recommendationDistribution.get(recommendedDeltaC.toFixed(1)) || 0) + 1
      );

      totalReward += reward;
      rewardSum += reward;
      rewardSquaredSum += reward * reward;

      if (session >= 10) {
        totalLE += rewardResult.leDelta;
        leCount++;
      }

      // 9. 崩溃检测
      // 检测theta是否发散
      if (Math.abs(theta) > 2.8 && collapsePoint === null) {
        collapsePoint = session;
        collapseReason = 'theta_divergence';
      }

      // 检测推荐是否崩溃
      const recentRecs = thetaTrajectory.slice(-10);
      if (recentRecs.length >= 10) {
        const recVariance = this.calculateVariance(recentRecs);
        if (recVariance > 2 && collapsePoint === null) {
          collapsePoint = session;
          collapseReason = 'recommendation_variance_explosion';
        }
      }

      // 进度输出
      if (session % 200 === 0) {
        console.log(
          `Session ${session}: Theta=${theta.toFixed(2)}, ` +
          `Reward=${reward.toFixed(3)}, ` +
          `Collapse=${collapsePoint === null ? 'No' : `Yes at ${collapsePoint}`}`
        );
      }
    }

    // 计算最终指标
    const stability = this.calculateCS(recommendationDistribution);
    const learning_effect = leCount > 0 ? totalLE / leCount : 0;
    const reward_variance = maxSessions > 0
      ? (rewardSquaredSum / maxSessions) - (rewardSum / maxSessions) ** 2
      : 0;

    // 检测伪收敛
    const pseudo_convergence = this.detectPseudoConvergence(
      stability,
      learning_effect,
      reward_variance,
      thetaTrajectory
    );

    // 确定失败类型
    const failure_type = this.classifyFailure(
      envConfig,
      stability,
      learning_effect,
      collapsePoint,
      pseudo_convergence
    );

    const converged = stability >= 0.5 && learning_effect > 0 && collapsePoint === null;

    return {
      environment: envConfig.name,
      sessions: maxSessions,
      stability,
      learning_effect,
      reward_variance,
      collapse_point: collapsePoint,
      failure_type: failure_type,
      converged,
      analysis: {
        initial_theta: initialTheta,
        final_theta: theta,
        theta_trajectory: thetaTrajectory,
        recommendation_distribution: recommendationDistribution,
        reward_history: rewardHistory,
        collapse_detected: collapsePoint !== null,
        collapse_reason: collapseReason,
        pseudo_convergence,
      },
    };
  }

  /**
   * 计算方差
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  /**
   * 计算CS (Convergence Stability)
   */
  private calculateCS(distribution: Map<string, number>): number {
    const total = Array.from(distribution.values()).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    let expected = 0;
    for (const [deltaC, count] of distribution) {
      expected += parseFloat(deltaC) * (count / total);
    }

    let variance = 0;
    for (const [deltaC, count] of distribution) {
      const diff = parseFloat(deltaC) - expected;
      variance += diff * diff * (count / total);
    }

    const normalizedVariance = variance / 25;
    return Math.max(0, 1 - normalizedVariance);
  }

  /**
   * 检测伪收敛（指标好看但实际无意义）
   */
  private detectPseudoConvergence(
    stability: number,
    learning_effect: number,
    reward_variance: number,
    thetaTrajectory: number[]
  ): boolean {
    // 情况1：高稳定性但学习效果为0
    if (stability > 0.8 && Math.abs(learning_effect) < 0.01) {
      return true;
    }

    // 情况2：高稳定性但theta完全不变
    const thetaChange = Math.abs(thetaTrajectory[thetaTrajectory.length - 1] - thetaTrajectory[0]);
    if (stability > 0.8 && thetaChange < 0.01) {
      return true;
    }

    // 情况3：低方差但reward完全随机
    if (reward_variance > 0.5 && stability > 0.7) {
      return true;
    }

    return false;
  }

  /**
   * 分类失败类型
   */
  private classifyFailure(
    envConfig: DestructionConfig,
    stability: number,
    learning_effect: number,
    collapsePoint: number | null,
    pseudoConvergence: boolean
  ): FailureType {
    if (collapsePoint !== null) {
      if (envConfig.type === 'label_chaos') {
        return 'label_noise_failure';
      } else if (envConfig.type === 'feedback_delay') {
        return 'delayed_feedback_failure';
      } else if (envConfig.type === 'feature_poisoning') {
        return 'representation_break';
      } else if (envConfig.type === 'distribution_shift') {
        return 'distribution_shift_failure';
      }
    }

    if (pseudoConvergence) {
      return 'policy_instability';
    }

    if (stability < 0.3) {
      return 'policy_instability';
    }

    return 'none';
  }
}

// ==================== 预设破坏环境 ====================

const DESTRUCTION_ENVIRONMENTS: Record<string, DestructionConfig> = {
  // 1. 标签混乱
  label_chaos_mild: {
    name: 'label_chaos_mild',
    description: '轻度标签混乱 (10%翻转)',
    type: 'label_chaos',
    params: {
      flipRate: 0.10,
      inconsistencyRate: 0.05,
      randomDifficulty: false,
    },
  },
  label_chaos_severe: {
    name: 'label_chaos_severe',
    description: '严重标签混乱 (30%翻转)',
    type: 'label_chaos',
    params: {
      flipRate: 0.30,
      inconsistencyRate: 0.20,
      randomDifficulty: true,
    },
  },

  // 2. 反馈延迟
  delay_mild: {
    name: 'delay_mild',
    description: '轻度反馈延迟 (10步)',
    type: 'feedback_delay',
    params: {
      delaySteps: 10,
      lossRate: 0.0,
      stochasticDelay: false,
    },
  },
  delay_severe: {
    name: 'delay_severe',
    description: '严重反馈延迟 (50步 + 20%丢失)',
    type: 'feedback_delay',
    params: {
      delaySteps: 50,
      lossRate: 0.20,
      stochasticDelay: true,
    },
  },

  // 3. 特征污染
  poison_mild: {
    name: 'poison_mild',
    description: '轻度特征污染 (10%错配)',
    type: 'feature_poisoning',
    params: {
      knowledgePointMismatchRate: 0.10,
      deltaCDriftSpeed: 0.0001,
      thetaNoise: 0.1,
    },
  },
  poison_severe: {
    name: 'poison_severe',
    description: '严重特征污染 (40%错配 + 高漂移)',
    type: 'feature_poisoning',
    params: {
      knowledgePointMismatchRate: 0.40,
      deltaCDriftSpeed: 0.001,
      thetaNoise: 0.5,
    },
  },

  // 4. 分布偏移
  shift_easy_to_hard: {
    name: 'shift_easy_to_hard',
    description: '分布偏移: 简单→困难',
    type: 'distribution_shift',
    params: {
      shiftPoint: 0.5,
      shiftType: 'easy_to_hard',
      driftSeverity: 0.8,
    },
  },
  shift_reverse: {
    name: 'shift_reverse',
    description: '分布偏移: 完全反转',
    type: 'distribution_shift',
    params: {
      shiftPoint: 0.3,
      shiftType: 'reverse',
      driftSeverity: 1.0,
    },
  },
};

// ==================== 预设策略攻击学生 ====================

const STRATEGIC_STUDENTS: Record<string, StrategicStudentConfig> = {
  inverse_learner: {
    name: 'inverse_learner',
    description: '越错越强（逆学习）',
    baseTheta: 0,
    slipRate: 0.1,
    guessRate: 0.05,
    learningRate: 0.005,
    strategy: 'inverse_learner',
  },
  stubborn_learner: {
    name: 'stubborn_learner',
    description: '永不学习（顽固）',
    baseTheta: 0.5,
    slipRate: 0.15,
    guessRate: 0.1,
    learningRate: 0.003,
    strategy: 'stubborn_learner',
  },
  random_strategist: {
    name: 'random_strategist',
    description: '策略随机切换',
    baseTheta: 0,
    slipRate: 0.1,
    guessRate: 0.1,
    learningRate: 0.003,
    strategy: 'random_strategist',
  },
  overconfident: {
    name: 'overconfident',
    description: '过度自信',
    baseTheta: 1.0,
    slipRate: 0.2,
    guessRate: 0.05,
    learningRate: 0.003,
    strategy: 'overconfident',
  },
  oscillating: {
    name: 'oscillating',
    description: '能力剧烈震荡',
    baseTheta: 0,
    slipRate: 0.1,
    guessRate: 0.1,
    learningRate: 0.01,
    strategy: 'oscillating',
  },
};

// ==================== 失败地图生成器 ====================

interface FailureMapEntry {
  environment: string;
  collapse_point: number | null;
  stable: boolean;
  failure_type: FailureType;
  stability: number;
  learning_effect: number;
  pseudo_convergence: boolean;
}

class FailureMapGenerator {
  private entries: FailureMapEntry[] = [];

  addEntry(metrics: DestructionMetrics): void {
    this.entries.push({
      environment: metrics.environment,
      collapse_point: metrics.collapse_point,
      stable: metrics.converged,
      failure_type: metrics.failure_type,
      stability: metrics.stability,
      learning_effect: metrics.learning_effect,
      pseudo_convergence: metrics.analysis.pseudo_convergence,
    });
  }

  generate(): string {
    let output = '\n';
    output += '╔══════════════════════════════════════════════════════════════════════════════╗\n';
    output += '║                          💥 失败地图 (Failure Map)                            ║\n';
    output += '╚══════════════════════════════════════════════════════════════════════════════╝\n';
    output += '\n';
    output += '┌────────────────────────────────┬──────────────┬──────────┬─────────────────────────┐\n';
    output += '│ 环境                           │ 崩溃点       │ 稳定     │ 失败原因                │\n';
    output += '├────────────────────────────────┼──────────────┼──────────┼─────────────────────────┤\n';

    for (const entry of this.entries) {
      const collapseStr = entry.collapse_point === null
        ? '未崩溃'.padEnd(12)
        : `Step ${entry.collapse_point}`.padEnd(12);

      const stableStr = entry.stable
        ? '✅ 稳定'
        : '❌ 失效';

      const reasonStr = entry.failure_type === 'none'
        ? '系统稳定'
        : entry.pseudo_convergence
          ? '⚠️  伪收敛'
          : this.formatFailureType(entry.failure_type);

      output += `│ ${entry.environment.padEnd(30)} │ ${collapseStr} │ ${stableStr} │ ${reasonStr.padEnd(23)} │\n`;
    }

    output += '└────────────────────────────────┴──────────────┴──────────┴─────────────────────────┘\n';
    output += '\n';

    // 统计分析
    output += '📊 破坏性统计:\n';
    output += '\n';

    const totalEnvironments = this.entries.length;
    const collapsedEnvironments = this.entries.filter(e => e.collapse_point !== null).length;
    const pseudoConvergedEnvironments = this.entries.filter(e => e.pseudo_convergence).length;
    const trulyStableEnvironments = this.entries.filter(e => e.stable && !e.pseudo_convergence).length;

    output += `  总测试环境: ${totalEnvironments}\n`;
    output += `  崩溃环境: ${collapsedEnvironments} (${(collapsedEnvironments / totalEnvironments * 100).toFixed(1)}%)\n`;
    output += `  伪收敛环境: ${pseudoConvergedEnvironments} (${(pseudoConvergedEnvironments / totalEnvironments * 100).toFixed(1)}%)\n`;
    output += `  真正稳定环境: ${trulyStableEnvironments} (${(trulyStableEnvironments / totalEnvironments * 100).toFixed(1)}%)\n`;
    output += '\n';

    // 找出最早崩溃点
    const earliestCollapse = this.entries
      .filter(e => e.collapse_point !== null)
      .sort((a, b) => (a.collapse_point || Infinity) - (b.collapse_point || Infinity))[0];

    if (earliestCollapse && earliestCollapse.collapse_point) {
      output += `⚠️  最早崩溃点: ${earliestCollapse.environment} at step ${earliestCollapse.collapse_point}\n`;
      output += `\n`;
    }

    // 最脆弱的3个假设
    output += '🎯 最脆弱的3个假设:\n';
    output += '\n';

    const failureTypes = new Map<FailureType, number>();
    for (const entry of this.entries) {
      if (entry.failure_type !== 'none') {
        failureTypes.set(
          entry.failure_type,
          (failureTypes.get(entry.failure_type) || 0) + 1
        );
      }
    }

    const sortedFailures = Array.from(failureTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (let i = 0; i < sortedFailures.length; i++) {
      const [type, count] = sortedFailures[i];
      const description = this.getFailureDescription(type);
      output += `  ${i + 1}. ${description} (${count}个环境)\n`;
    }
    output += '\n';

    // 系统稳定性评估
    output += '🔍 系统稳定性评估:\n';
    output += '\n';

    const stabilityRatio = trulyStableEnvironments / totalEnvironments;
    let systemStability: 'stable' | 'fragile' | 'broken';
    let viabilityScore: number;
    let recommendation: string;

    if (stabilityRatio >= 0.7) {
      systemStability = 'stable';
      viabilityScore = 0.8 + (stabilityRatio - 0.7) * 0.67; // 0.8-1.0
      recommendation = '系统整体鲁棒，可在大多数真实环境使用';
    } else if (stabilityRatio >= 0.3) {
      systemStability = 'fragile';
      viabilityScore = 0.3 + (stabilityRatio - 0.3) * 1.67; // 0.3-0.8
      recommendation = '系统脆弱，需要针对性加固失效点';
    } else {
      systemStability = 'broken';
      viabilityScore = stabilityRatio * 1.0; // 0-0.3
      recommendation = '系统存在结构性缺陷，需要重新设计核心组件';
    }

    output += `  系统状态: ${systemStability.toUpperCase()}\n`;
    output += `  现实可行性评分: ${(viabilityScore * 100).toFixed(0)} / 100\n`;
    output += `  建议: ${recommendation}\n`;
    output += '\n';

    // 需要重新设计的部分
    if (systemStability !== 'stable') {
      output += '🔧 需要重新设计的部分:\n';
      output += '\n';

      for (const [type, count] of sortedFailures) {
        const redesign = this.getRedesignRecommendation(type);
        output += `  • ${redesign}\n`;
      }
      output += '\n';
    }

    return output;
  }

  private formatFailureType(type: FailureType): string {
    const names: Record<FailureType, string> = {
      label_noise_failure: '标签噪声失效',
      delayed_feedback_failure: '延迟反馈失效',
      representation_break: '表示崩溃',
      policy_instability: '策略不稳定',
      distribution_shift_failure: '分布偏移失效',
      none: '无',
    };
    return names[type];
  }

  private getFailureDescription(type: FailureType): string {
    const descriptions: Record<FailureType, string> = {
      label_noise_failure: '系统依赖稳定标签假设',
      delayed_feedback_failure: '系统依赖即时反馈假设',
      representation_break: '特征映射是单点失败源',
      policy_instability: '策略缺乏鲁棒性',
      distribution_shift_failure: '系统无法处理分布变化',
      none: '无',
    };
    return descriptions[type];
  }

  private getRedesignRecommendation(type: FailureType): string {
    const recommendations: Record<FailureType, string> = {
      label_noise_failure: '引入标签噪声检测与容错机制',
      delayed_feedback_failure: '实现延迟反馈补偿算法',
      representation_break: '解耦特征映射与推荐逻辑',
      policy_instability: '增加探索率与自适应调节',
      distribution_shift_failure: '实现分布偏移检测与在线适应',
      none: '',
    };
    return recommendations[type];
  }
}

// ==================== 主函数 ====================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full'; // full, quick, single
  const json = args.includes('--json');

  const simulator = new DestructionSimulator(0.5);
  const failureMap = new FailureMapGenerator();

  if (mode === 'single') {
    const envName = args[1] || 'label_chaos_mild';
    const studentName = args[2] || 'inverse_learner';
    const maxSessions = parseInt(args[3]) || 1000;

    const envConfig = DESTRUCTION_ENVIRONMENTS[envName];
    const studentConfig = STRATEGIC_STUDENTS[studentName];

    if (!envConfig) {
      console.error(`Unknown environment: ${envName}`);
      console.error(`Available: ${Object.keys(DESTRUCTION_ENVIRONMENTS).join(', ')}`);
      process.exit(1);
    }

    if (!studentConfig) {
      console.error(`Unknown student: ${studentName}`);
      console.error(`Available: ${Object.keys(STRATEGIC_STUDENTS).join(', ')}`);
      process.exit(1);
    }

    const metrics = await simulator.destruct(envConfig, studentConfig, maxSessions);
    failureMap.addEntry(metrics);

    if (json) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      console.log(failureMap.generate());
    }
  } else if (mode === 'quick') {
    // 快速测试：每种环境类型测试一个
    const quickTests = [
      { env: 'label_chaos_mild', student: 'inverse_learner' },
      { env: 'delay_mild', student: 'stubborn_learner' },
      { env: 'poison_mild', student: 'random_strategist' },
      { env: 'shift_easy_to_hard', student: 'overconfident' },
    ];

    for (const test of quickTests) {
      const envConfig = DESTRUCTION_ENVIRONMENTS[test.env];
      const studentConfig = STRATEGIC_STUDENTS[test.student];
      const metrics = await simulator.destruct(envConfig, studentConfig, 500);
      failureMap.addEntry(metrics);
    }

    if (json) {
      console.log(JSON.stringify(failureMap, null, 2));
    } else {
      console.log(failureMap.generate());
    }
  } else {
    // 完整测试：所有环境 × 关键学生
    const fullTests = [
      // 标签混乱 × 逆学习
      { env: 'label_chaos_mild', student: 'inverse_learner' },
      { env: 'label_chaos_severe', student: 'inverse_learner' },
      // 反馈延迟 × 顽固学生
      { env: 'delay_mild', student: 'stubborn_learner' },
      { env: 'delay_severe', student: 'stubborn_learner' },
      // 特征污染 × 随机策略
      { env: 'poison_mild', student: 'random_strategist' },
      { env: 'poison_severe', student: 'random_strategist' },
      // 分布偏移 × 过度自信
      { env: 'shift_easy_to_hard', student: 'overconfident' },
      { env: 'shift_reverse', student: 'overconfident' },
      // 震荡 × 所有环境
      { env: 'label_chaos_mild', student: 'oscillating' },
      { env: 'delay_mild', student: 'oscillating' },
    ];

    for (const test of fullTests) {
      const envConfig = DESTRUCTION_ENVIRONMENTS[test.env];
      const studentConfig = STRATEGIC_STUDENTS[test.student];
      const metrics = await simulator.destruct(envConfig, studentConfig, 1000);
      failureMap.addEntry(metrics);
    }

    if (json) {
      console.log(JSON.stringify(failureMap, null, 2));
    } else {
      console.log(failureMap.generate());
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { DestructionSimulator, FailureMapGenerator, DESTRUCTION_ENVIRONMENTS, STRATEGIC_STUDENTS };
export type { DestructionConfig, StrategicStudentConfig, DestructionMetrics, FailureType };
