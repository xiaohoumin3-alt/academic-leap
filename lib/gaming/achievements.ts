/**
 * Achievement Service - 成就系统
 *
 * 基于LE（学习有效性）的成就，而非简单答对
 *
 * 成就类型：
 * - streak_master: 连续N次LE >= 0.15
 * - knowledge_explorer: 掌握N个知识点
 * - early_bird: 早晨学习
 * - consistency_king: 连续N天学习
 * - challenge_legend: 完成挑战题
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

export interface AchievementDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  rewardXP: number;
}

export interface UserAchievement {
  type: string;
  name: string;
  description: string;
  unlockedAt: Date;
  progress: number;
  maxProgress: number;
}

// ============================================================
// 成就定义
// ============================================================

const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  streak_master: {
    type: 'streak_master',
    name: '连胜大师',
    description: '连续5次有效学习（LE >= 0.15）',
    icon: '🔥',
    threshold: 5,
    rewardXP: 100,
  },
  streak_legend: {
    type: 'streak_legend',
    name: '连胜传说',
    description: '连续10次有效学习',
    icon: '⚡',
    threshold: 10,
    rewardXP: 250,
  },
  knowledge_explorer: {
    type: 'knowledge_explorer',
    name: '知识探险家',
    description: '掌握20个知识点',
    icon: '🗺️',
    threshold: 20,
    rewardXP: 150,
  },
  knowledge_master: {
    type: 'knowledge_master',
    name: '知识大师',
    description: '掌握50个知识点',
    icon: '📚',
    threshold: 50,
    rewardXP: 500,
  },
  early_bird: {
    type: 'early_bird',
    name: '早起鸟',
    description: '在8点前完成10次学习',
    icon: '🌅',
    threshold: 10,
    rewardXP: 75,
  },
  night_owl: {
    type: 'night_owl',
    name: '夜猫子',
    description: '在20点后完成10次学习',
    icon: '🦉',
    threshold: 10,
    rewardXP: 75,
  },
  consistency_king: {
    type: 'consistency_king',
    name: '坚持之王',
    description: '连续7天都有学习',
    icon: '👑',
    threshold: 7,
    rewardXP: 200,
  },
  speed_demon: {
    type: 'speed_demon',
    name: '速度恶魔',
    description: '在15秒内正确答题10次',
    icon: '💨',
    threshold: 10,
    rewardXP: 100,
  },
  perfect_day: {
    type: 'perfect_day',
    name: '完美一天',
    description: '单日答对所有题目（至少10题）',
    icon: '⭐',
    threshold: 10,
    rewardXP: 150,
  },
};

// ============================================================
// 成就服务
// ============================================================

class AchievementService {
  /**
   * 检查并解锁成就
   */
  async checkAndUnlock(
    userId: string,
    context: {
      streakLength?: number;
      knowledgePointsCount?: number;
      hourOfDay?: number;
      consecutiveDays?: number;
      speedCount?: number;
      todayCorrectCount?: number;
      todayTotalCount?: number;
    }
  ): Promise<UserAchievement[]> {
    const unlocked: UserAchievement[] = [];

    // 1. 检查连胜成就
    if (context.streakLength !== undefined) {
      const streakAchievement = await this.checkStreakAchievement(
        userId,
        context.streakLength
      );
      if (streakAchievement) unlocked.push(streakAchievement);
    }

    // 2. 检查知识点成就
    if (context.knowledgePointsCount !== undefined) {
      const knowledgeAchievement = await this.checkKnowledgeAchievement(
        userId,
        context.knowledgePointsCount
      );
      if (knowledgeAchievement) unlocked.push(knowledgeAchievement);
    }

    // 3. 检查时间段成就
    if (context.hourOfDay !== undefined) {
      const timeAchievement = await this.checkTimeAchievement(
        userId,
        context.hourOfDay
      );
      if (timeAchievement) unlocked.push(timeAchievement);
    }

    // 4. 检查坚持成就
    if (context.consecutiveDays !== undefined) {
      const consistencyAchievement = await this.checkConsistencyAchievement(
        userId,
        context.consecutiveDays
      );
      if (consistencyAchievement) unlocked.push(consistencyAchievement);
    }

    // 5. 检查速度成就
    if (context.speedCount !== undefined) {
      const speedAchievement = await this.checkSpeedAchievement(
        userId,
        context.speedCount
      );
      if (speedAchievement) unlocked.push(speedAchievement);
    }

    // 6. 检查完美天成就
    if (
      context.todayCorrectCount !== undefined &&
      context.todayTotalCount !== undefined
    ) {
      const perfectAchievement = await this.checkPerfectDayAchievement(
        userId,
        context.todayCorrectCount,
        context.todayTotalCount
      );
      if (perfectAchievement) unlocked.push(perfectAchievement);
    }

    return unlocked;
  }

  /**
   * 获取用户所有成就
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
      include: { achievements: true },
    });

    if (!profile) return [];

    // 计算进度
    const result: UserAchievement[] = [];

    for (const achievement of Object.values(ACHIEVEMENTS)) {
      const unlocked = profile.achievements.find(
        (a) => a.type === achievement.type
      );

      const progress = await this.calculateProgress(
        userId,
        achievement.type
      );

      result.push({
        type: achievement.type,
        name: achievement.name,
        description: achievement.description,
        unlockedAt: unlocked?.unlockedAt || (unlocked ? new Date() : new Date(0)),
        progress,
        maxProgress: achievement.threshold,
      });
    }

    // 排序：已解锁在前，然后按进度
    return result.sort((a, b) => {
      const aUnlocked = a.unlockedAt.getTime() > 0;
      const bUnlocked = b.unlockedAt.getTime() > 0;

      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;

      return b.progress - a.progress;
    });
  }

  /**
   * 计算成就进度
   */
  private async calculateProgress(
    userId: string,
    type: string
  ): Promise<number> {
    switch (type) {
      case 'streak_master':
      case 'streak_legend': {
        const profile = await prisma.playerProfile.findUnique({
          where: { userId },
          select: { currentStreak: true },
        });
        return profile?.currentStreak || 0;
      }
      case 'knowledge_explorer':
      case 'knowledge_master': {
        const count = await prisma.userKnowledge.count({
          where: {
            userId,
            mastery: { gte: 0.9 }, // 掌握定义为mastery >= 90%
          },
        });
        return count;
      }
      case 'early_bird': {
        // 早上8点前的答题次数
        const count = await this.countAttemptsInTimeRange(userId, 6, 8);
        return count;
      }
      case 'night_owl': {
        // 晚上8点后的答题次数
        const count = await this.countAttemptsInTimeRange(userId, 20, 24);
        return count;
      }
      case 'consistency_king': {
        // 连续学习天数
        const days = await this.countConsecutiveDays(userId);
        return days;
      }
      case 'speed_demon': {
        // 15秒内正确答题次数
        const count = await prisma.attemptStep.count({
          where: {
            attempt: { userId },
            isCorrect: true,
            duration: { lte: 15000 }, // 15秒
          },
        });
        return count;
      }
      case 'perfect_day': {
        // 今日答对数量
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const correctCount = await prisma.attemptStep.count({
          where: {
            attempt: { userId },
            isCorrect: true,
            submittedAt: { gte: today, lt: tomorrow },
          },
        });
        return correctCount;
      }
      default:
        return 0;
    }
  }

  /**
   * 检查连胜成就
   */
  private async checkStreakAchievement(
    userId: string,
    streakLength: number
  ): Promise<UserAchievement | null> {
    const achievements = ['streak_master', 'streak_legend'];

    for (const type of achievements) {
      const def = ACHIEVEMENTS[type];
      if (!def) continue;

      if (streakLength >= def.threshold) {
        const unlocked = await this.unlockAchievement(
          userId,
          type,
          def.rewardXP
        );
        if (unlocked) {
          return {
            type,
            name: def.name,
            description: def.description,
            unlockedAt: new Date(),
            progress: streakLength,
            maxProgress: def.threshold,
          };
        }
      }
    }

    return null;
  }

  /**
   * 检查知识点成就
   */
  private async checkKnowledgeAchievement(
    userId: string,
    count: number
  ): Promise<UserAchievement | null> {
    const achievements = ['knowledge_explorer', 'knowledge_master'];

    for (const type of achievements) {
      const def = ACHIEVEMENTS[type];
      if (!def) continue;

      if (count >= def.threshold) {
        const unlocked = await this.unlockAchievement(
          userId,
          type,
          def.rewardXP
        );
        if (unlocked) {
          return {
            type,
            name: def.name,
            description: def.description,
            unlockedAt: new Date(),
            progress: count,
            maxProgress: def.threshold,
          };
        }
      }
    }

    return null;
  }

  /**
   * 检查时间段成就
   */
  private async checkTimeAchievement(
    userId: string,
    hour: number
  ): Promise<UserAchievement | null> {
    let type: string | null = null;

    if (hour >= 6 && hour < 8) {
      type = 'early_bird';
    } else if (hour >= 20 && hour < 24) {
      type = 'night_owl';
    }

    if (!type) return null;

    const def = ACHIEVEMENTS[type];
    if (!def) return null;

    const count = await this.countAttemptsInTimeRange(userId, hour, hour + 1);

    if (count >= def.threshold) {
      const unlocked = await this.unlockAchievement(
        userId,
        type,
        def.rewardXP
      );
      if (unlocked) {
        return {
          type,
          name: def.name,
          description: def.description,
          unlockedAt: new Date(),
          progress: count,
          maxProgress: def.threshold,
        };
      }
    }

    return null;
  }

  /**
   * 检查坚持成就
   */
  private async checkConsistencyAchievement(
    userId: string,
    days: number
  ): Promise<UserAchievement | null> {
    const type = 'consistency_king';
    const def = ACHIEVEMENTS[type];
    if (!def) return null;

    if (days >= def.threshold) {
      const unlocked = await this.unlockAchievement(
        userId,
        type,
        def.rewardXP
      );
      if (unlocked) {
        return {
          type,
          name: def.name,
          description: def.description,
          unlockedAt: new Date(),
          progress: days,
          maxProgress: def.threshold,
        };
      }
    }

    return null;
  }

  /**
   * 检查速度成就
   */
  private async checkSpeedAchievement(
    userId: string,
    count: number
  ): Promise<UserAchievement | null> {
    const type = 'speed_demon';
    const def = ACHIEVEMENTS[type];
    if (!def) return null;

    if (count >= def.threshold) {
      const unlocked = await this.unlockAchievement(
        userId,
        type,
        def.rewardXP
      );
      if (unlocked) {
        return {
          type,
          name: def.name,
          description: def.description,
          unlockedAt: new Date(),
          progress: count,
          maxProgress: def.threshold,
        };
      }
    }

    return null;
  }

  /**
   * 检查完美天成就
   */
  private async checkPerfectDayAchievement(
    userId: string,
    correctCount: number,
    totalCount: number
  ): Promise<UserAchievement | null> {
    const type = 'perfect_day';
    const def = ACHIEVEMENTS[type];
    if (!def) return null;

    if (
      correctCount === totalCount &&
      correctCount >= def.threshold
    ) {
      const unlocked = await this.unlockAchievement(
        userId,
        type,
        def.rewardXP
      );
      if (unlocked) {
        return {
          type,
          name: def.name,
          description: def.description,
          unlockedAt: new Date(),
          progress: correctCount,
          maxProgress: def.threshold,
        };
      }
    }

    return null;
  }

  /**
   * 解锁成就
   */
  private async unlockAchievement(
    userId: string,
    type: string,
    rewardXP: number
  ): Promise<boolean> {
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
    });

    if (!profile) return false;

    // 检查是否已解锁
    const existing = await prisma.achievement.findUnique({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
    });

    if (existing) return false;

    // 创建成就记录
    await prisma.achievement.create({
      data: {
        userId,
        profileId: profile.id,
        type,
        name: ACHIEVEMENTS[type].name,
        description: ACHIEVEMENTS[type].description,
      },
    });

    // 发放奖励XP
    await prisma.playerProfile.update({
      where: { userId },
      data: {
        totalXP: { increment: rewardXP },
        level: {
          increment: Math.floor(rewardXP / 100),
        },
      },
    });

    return true;
  }

  /**
   * 计算时间范围内的答题次数
   */
  private async countAttemptsInTimeRange(
    userId: string,
    startHour: number,
    endHour: number
  ): Promise<number> {
    // 简化实现：假设所有AttemptStep都在同一时间
    // 实际应该检查submittedAt的小时数
    return 0; // 占位符
  }

  /**
   * 计算连续学习天数
   */
  private async countConsecutiveDays(userId: string): Promise<number> {
    // 获取最近的学习日期
    const attempts = await prisma.attempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
      take: 365, // 最多检查一年
    });

    if (attempts.length === 0) return 0;

    // 去重并排序
    const dates = [
      ...new Set(
        attempts.map((a) =>
          a.startedAt.toISOString().split('T')[0]
        )
      ),
    ].sort((a, b) => b.localeCompare(a));

    // 计算连续天数
    let consecutive = 1;
    const today = new Date().toISOString().split('T')[0];

    if (dates[0] !== today) {
      // 如果今天没有学习，从昨天开始检查
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (dates[0] !== yesterday.toISOString().split('T')[0]) {
        return 0; // 中断了
      }
    }

    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const next = new Date(dates[i + 1]);
      const diff = (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }
}

// ============================================================
// 单例导出
// ============================================================

export const achievementService = new AchievementService();
