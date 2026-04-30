/**
 * Parental Control Service - 家长控制服务
 *
 * 允许家长配置游戏化功能
 * 确保家长友好
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

export interface ParentalControlSettings {
  gamificationEnabled: boolean;
  dailyXPCap: number;
  allowedTimeStart: string; // HH:MM format
  allowedTimeEnd: string; // HH:MM format
  showRankings: boolean;
  rewardThreshold: number;
}

export interface TimeRestrictionResult {
  allowed: boolean;
  reason?: string;
}

export interface XPCapResult {
  allowed: boolean;
  currentXP: number;
  remainingXP: number;
  resetAt: Date;
}

// ============================================================
// 家长控制服务
// ============================================================

class ParentalControlService {
  /**
   * 获取家长控制设置
   */
  async getSettings(userId: string): Promise<ParentalControlSettings> {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
      include: { parentalControls: true },
    });

    if (!profile?.parentalControls) {
      // 默认设置
      return {
        gamificationEnabled: true,
        dailyXPCap: 500,
        allowedTimeStart: '08:00',
        allowedTimeEnd: '21:00',
        showRankings: true,
        rewardThreshold: 100,
      };
    }

    const pc = profile.parentalControls;
    return {
      gamificationEnabled: pc.gamificationEnabled,
      dailyXPCap: pc.dailyXPCap,
      allowedTimeStart: pc.allowedTimeStart || '08:00',
      allowedTimeEnd: pc.allowedTimeEnd || '21:00',
      showRankings: pc.showRankings,
      rewardThreshold: pc.rewardThreshold,
    };
  }

  /**
   * 更新家长控制设置
   */
  async updateSettings(
    userId: string,
    settings: Partial<ParentalControlSettings>
  ): Promise<ParentalControlSettings> {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Player profile not found');
    }

    const current = await this.getSettings(userId);
    const updated = { ...current, ...settings };

    await prisma.parentalControl.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        gamificationEnabled: updated.gamificationEnabled,
        dailyXPCap: updated.dailyXPCap,
        allowedTimeStart: updated.allowedTimeStart,
        allowedTimeEnd: updated.allowedTimeEnd,
        showRankings: updated.showRankings,
        rewardThreshold: updated.rewardThreshold,
      },
      update: {
        gamificationEnabled: updated.gamificationEnabled,
        dailyXPCap: updated.dailyXPCap,
        allowedTimeStart: updated.allowedTimeStart,
        allowedTimeEnd: updated.allowedTimeEnd,
        showRankings: updated.showRankings,
        rewardThreshold: updated.rewardThreshold,
      },
    });

    return updated;
  }

  /**
   * 检查时间限制
   */
  async checkTimeRestriction(userId: string): Promise<TimeRestrictionResult> {
    const settings = await this.getSettings(userId);

    if (!settings.gamificationEnabled) {
      return { allowed: false, reason: '游戏化已禁用' };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = settings.allowedTimeStart
      .split(':')
      .map(Number);
    const [endHour, endMinute] = settings.allowedTimeEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (currentTime < startTime) {
      return {
        allowed: false,
        reason: `尚未到允许时间（${settings.allowedTimeStart}）`,
      };
    }

    if (currentTime > endTime) {
      return {
        allowed: false,
        reason: `已超过允许时间（${settings.allowedTimeEnd}）`,
      };
    }

    return { allowed: true };
  }

  /**
   * 检查每日XP上限
   */
  async checkDailyXPCap(userId: string): Promise<XPCapResult> {
    const settings = await this.getSettings(userId);

    if (!settings.gamificationEnabled) {
      return {
        allowed: false,
        currentXP: 0,
        remainingXP: 0,
        resetAt: this.getNextResetTime(),
      };
    }

    // 获取今日已获得的XP
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 从暴击日志统计今日XP
    const criticalHits = await prisma.criticalHitLog.findMany({
      where: {
        userId,
        loggedAt: { gte: today, lt: tomorrow },
      },
    });

    const todayXP = criticalHits.reduce(
      (sum, hit) => sum + hit.baseXP + hit.bonusXP,
      0
    );

    const remainingXP = Math.max(0, settings.dailyXPCap - todayXP);

    return {
      allowed: remainingXP > 0,
      currentXP: todayXP,
      remainingXP,
      resetAt: this.getNextResetTime(),
    };
  }

  /**
   * 获取每日学习报告（给家长）
   */
  async getDailyReport(userId: string): Promise<{
    date: Date;
    totalXP: number;
    questionsAnswered: number;
    correctRate: number;
    leDelta: number;
    timeSpent: number; // 分钟
    achievementsUnlocked: string[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 获取今日尝试
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        startedAt: { gte: today, lt: tomorrow },
      },
      include: {
        steps: true,
      },
    });

    // 获取今日XP
    const criticalHits = await prisma.criticalHitLog.findMany({
      where: {
        userId,
        loggedAt: { gte: today, lt: tomorrow },
      },
    });

    const totalXP = criticalHits.reduce(
      (sum, hit) => sum + hit.baseXP + hit.bonusXP,
      0
    );

    // 计算正确率
    const allSteps = attempts.flatMap((a) => a.steps);
    const correctSteps = allSteps.filter((s) => s.isCorrect).length;
    const correctRate = allSteps.length > 0
      ? correctSteps / allSteps.length
      : 0;

    // 获取今日解锁的成就
    const achievements = await prisma.achievement.findMany({
      where: {
        userId,
        unlockedAt: { gte: today, lt: tomorrow },
      },
    });

    // 计算时间花费
    const timeSpent = attempts.reduce((sum, a) => sum + a.duration, 0) / 60;

    // 计算LE（需要从RLTrainingLog获取）
    const leRecords = await prisma.rLTrainingLog.findMany({
      where: {
        userId,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    const avgLE = leRecords.length > 0
      ? leRecords.reduce((sum, r) => sum + (r.leDelta || 0), 0) / leRecords.length
      : 0;

    return {
      date: today,
      totalXP,
      questionsAnswered: allSteps.length,
      correctRate,
      leDelta: avgLE,
      timeSpent,
      achievementsUnlocked: achievements.map((a) => a.type),
    };
  }

  /**
   * 获取学习趋势报告
   */
  async getTrendReport(userId: string, days: number = 7): Promise<{
    dates: string[];
    xp: number[];
    accuracy: number[];
    le: number[];
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const dates: string[] = [];
    const xp: number[] = [];
    const accuracy: number[] = [];
    const le: number[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateEnd.getDate() + 1);

      dates.push(dateStart.toISOString().split('T')[0]);

      // XP
      const criticalHits = await prisma.criticalHitLog.findMany({
        where: {
          userId,
          loggedAt: { gte: dateStart, lt: dateEnd },
        },
      });
      xp.push(
        criticalHits.reduce((sum, hit) => sum + hit.baseXP + hit.bonusXP, 0)
      );

      // 正确率
      const attempts = await prisma.attempt.findMany({
        where: {
          userId,
          startedAt: { gte: dateStart, lt: dateEnd },
        },
        include: { steps: true },
      });
      const allSteps = attempts.flatMap((a) => a.steps);
      const correctSteps = allSteps.filter((s) => s.isCorrect).length;
      accuracy.push(
        allSteps.length > 0 ? correctSteps / allSteps.length : 0
      );

      // LE
      const leRecords = await prisma.rLTrainingLog.findMany({
        where: {
          userId,
          createdAt: { gte: dateStart, lt: dateEnd },
        },
      });
      const avgLE = leRecords.length > 0
        ? leRecords.reduce((sum, r) => sum + (r.leDelta || 0), 0) / leRecords.length
        : 0;
      le.push(avgLE);
    }

    return { dates, xp, accuracy, le };
  }

  /**
   * 获取下次重置时间
   */
  private getNextResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const parentalControlService = new ParentalControlService();
