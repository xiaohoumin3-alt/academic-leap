/**
 * Gamification Event Listener - 观察者模式
 *
 * 核心原则：游戏化作为观察者层，永不干扰学习核心
 *
 * DFI保证：所有游戏化事件必须关联eventId，确保可追溯
 */

import { prisma } from '@/lib/prisma';
import { deadLetterQueue } from '@/lib/gaming/dead-letter-queue';
import { XP_CONSTANTS, CRITICAL_HIT_CONSTANTS, STREAK_CONSTANTS } from '@/lib/gaming/constants';

// ============================================================
// 类型定义
// ============================================================

export interface LearningEvent {
  eventId: string; // 必需：唯一事件ID
  attemptId: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  leDelta: number; // 学习有效性增量
  duration: number;
  timestamp: Date;
}

export interface GamificationReward {
  xp: number;
  isCriticalHit: boolean;
  criticalMultiplier: number;
  streakExtended: boolean;
  achievementUnlocked?: string;
}

// ============================================================
// 观察者模式：游戏化事件处理器
// ============================================================

class GamificationEventListener {
  private enabled: boolean = process.env.GAMIFICATION_ENABLED !== 'false';

  /**
   * 处理学习事件，计算游戏化奖励
   *
   * DFI保证：所有奖励记录必须关联eventId
   * 学习优先：奖励计算失败不影响学习流程
   */
  async processEvent(event: LearningEvent): Promise<GamificationReward | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      // 1. 检查家长控制
      const parentalControl = await this.getParentalControl(event.userId);
      if (parentalControl && !parentalControl.gamificationEnabled) {
        return null;
      }

      // 2. 计算基础XP（基于LE，非简单答对）
      const baseXP = this.calculateBaseXP(event);

      // 3. 检查暴击条件
      const criticalHit = this.checkCriticalHit(event, parentalControl);
      const finalXP = criticalHit.isCritical
        ? Math.floor(baseXP * criticalHit.multiplier)
        : baseXP;

      // 4. 更新连胜（仅基于LE >= 0.15的答对）
      const streakExtended = event.isCorrect && event.leDelta >= STREAK_CONSTANTS.LE_THRESHOLD;

      // 5. 更新玩家档案
      await this.updatePlayerProfile(event.userId, finalXP, streakExtended);

      // 6. 记录暴击日志（用于从LE计算中排除噪声）
      if (criticalHit.isCritical) {
        await this.logCriticalHit({
          userId: event.userId,
          attemptId: event.attemptId,
          questionId: event.questionId,
          multiplier: criticalHit.multiplier,
          baseXP,
          bonusXP: finalXP - baseXP,
          reason: criticalHit.reason,
        });
      }

      // 7. 检查成就解锁
      const achievement = await this.checkAchievements(event.userId);

      return {
        xp: finalXP,
        isCriticalHit: criticalHit.isCritical,
        criticalMultiplier: criticalHit.multiplier,
        streakExtended,
        achievementUnlocked: achievement || undefined,
      };
    } catch (error) {
      // 游戏化失败不影响学习核心
      // 但需要记录到Dead Letter Queue保证DFI
      console.error('[Gamification] Event processing failed (non-blocking):', error);

      await deadLetterQueue.logFailure({
        eventId: event.eventId,
        attemptId: event.attemptId,
        userId: event.userId,
        questionId: event.questionId,
        isCorrect: event.isCorrect,
        leDelta: event.leDelta,
        duration: event.duration,
        error: error instanceof Error ? error.message : String(error),
        failedAt: new Date(),
      });

      return null;
    }
  }

  /**
   * 计算基础XP
   *
   * 基于LE（学习有效性）而非简单正确率
   */
  private calculateBaseXP(event: LearningEvent): number {
    // 基础XP
    let xp = XP_CONSTANTS.BASE_XP;

    // LE加成
    if (event.leDelta > 0) {
      xp += Math.floor(event.leDelta * XP_CONSTANTS.LE_MULTIPLIER);
    }

    // 答对加成
    if (event.isCorrect) {
      xp += XP_CONSTANTS.CORRECT_BONUS;
    }

    return Math.max(xp, XP_CONSTANTS.MIN_XP);
  }

  /**
   * 检查暴击条件
   *
   * 暴击只影响积分，不影响学习指标
   */
  private checkCriticalHit(
    event: LearningEvent,
    parentalControl: any
  ): { isCritical: boolean; multiplier: number; reason: string } {
    // 家长控制可禁用暴击
    const ctrl = parentalControl;
    if (ctrl && !ctrl.showRankings) {
      return { isCritical: false, multiplier: 1, reason: 'disabled' };
    }

    const rng = Math.random();

    // 基础暴击率
    if (rng < CRITICAL_HIT_CONSTANTS.BASE_RATE) {
      return {
        isCritical: true,
        multiplier: CRITICAL_HIT_CONSTANTS.MULTIPLIERS.LUCKY_STREAK,
        reason: 'lucky_streak',
      };
    }

    // 双倍暴击
    if (rng < CRITICAL_HIT_CONSTANTS.DOUBLE_RATE) {
      return {
        isCritical: true,
        multiplier: CRITICAL_HIT_CONSTANTS.MULTIPLIERS.DOUBLE_LUCKY,
        reason: 'double_lucky',
      };
    }

    // 三倍暴击
    if (rng < CRITICAL_HIT_CONSTANTS.JACKPOT_RATE) {
      return {
        isCritical: true,
        multiplier: CRITICAL_HIT_CONSTANTS.MULTIPLIERS.JACKPOT,
        reason: 'jackpot',
      };
    }

    return { isCritical: false, multiplier: 1, reason: 'none' };
  }

  /**
   * 更新玩家档案
   *
   * 使用事务保证原子性，避免竞态条件
   */
  private async updatePlayerProfile(
    userId: string,
    xp: number,
    streakExtended: boolean
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 获取当前状态（加锁）
      const existing = await tx.playerProfile.findUnique({
        where: { userId },
      });

      if (!existing) {
        // 创建新档案
        await tx.playerProfile.create({
          data: {
            userId,
            totalXP: xp,
            level: this.calculateLevel(xp),
            currentStreak: streakExtended ? 1 : 0,
            bestStreak: streakExtended ? 1 : 0,
          },
        });
        return;
      }

      // 计算新值
      const newTotalXP = existing.totalXP + xp;
      const newLevel = this.calculateLevel(newTotalXP);
      const newStreak = streakExtended ? existing.currentStreak + 1 : 0;
      const newBestStreak = Math.max(existing.bestStreak, newStreak);

      // 原子更新
      await tx.playerProfile.update({
        where: { userId },
        data: {
          totalXP: newTotalXP,
          level: newLevel,
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          streakLastUpdate: new Date(),
        },
      });
    });
  }

  /**
   * 记录暴击日志
   *
   * 用于从LE计算中排除噪声
   */
  private async logCriticalHit(data: {
    userId: string;
    attemptId: string;
    questionId: string;
    multiplier: number;
    baseXP: number;
    bonusXP: number;
    reason: string;
  }): Promise<void> {
    await prisma.criticalHitLog.create({
      data: {
        userId: data.userId,
        attemptId: data.attemptId,
        questionId: data.questionId,
        xpMultiplier: data.multiplier,
        baseXP: data.baseXP,
        bonusXP: data.bonusXP,
        triggerReason: data.reason,
      },
    });
  }

  /**
   * 检查成就解锁
   */
  private async checkAchievements(userId: string): Promise<string | null> {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
      include: { achievements: true },
    });

    if (!profile) return null;

    // 连胜大师：连续5次LE >= 0.15
    if (profile.currentStreak >= 5) {
      const existing = profile.achievements.find((a) => a.type === 'streak_master');
      if (!existing) {
        await prisma.achievement.create({
          data: {
            userId,
            profileId: profile.id,
            type: 'streak_master',
            name: '连胜大师',
            description: '连续5次有效学习',
          },
        });
        return 'streak_master';
      }
    }

    return null;
  }

  /**
   * 获取家长控制设置
   */
  private async getParentalControl(userId: string) {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
      include: { parentalControls: true },
    });
    return profile?.parentalControls;
  }

  /**
   * 计算等级
   */
  private calculateLevel(totalXP: number): number {
    // 每100 XP升一级
    return Math.floor(totalXP / 100) + 1;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const gamificationListener = new GamificationEventListener();

/**
 * 集成点：在Attempt完成后调用
 *
 * 示例：
 * ```typescript
 * import { gamificationListener } from '@/lib/gaming/event-listener';
 *
 * const reward = await gamificationListener.processEvent({
 *   eventId: attempt.id,
 *   attemptId: attempt.id,
 *   userId: attempt.userId,
 *   questionId: question.id,
 *   isCorrect: step.isCorrect,
 *   leDelta: leResult.leDelta,
 *   duration: step.duration,
 *   timestamp: new Date(),
 * });
 * ```
 */
