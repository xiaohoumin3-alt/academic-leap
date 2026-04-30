/**
 * Gamification A/B Experiment Integration
 *
 * 游戏化功能的A/B实验集成
 *
 * 实验变体：
 * - control: 无游戏化
 * - basic: 基础积分
 * - full: 完整游戏化（积分+排行榜+成就）
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

export type GamificationVariant = 'control' | 'basic' | 'full';

export interface ExperimentConfig {
  enabled: boolean;
  name: string;
  variants: GamificationVariant[];
  weights: number[]; // 对应variants的权重
}

export interface UserAssignment {
  userId: string;
  variant: GamificationVariant;
  assignedAt: Date;
}

// ============================================================
// 游戏化实验配置
// ============================================================

const GAMIFICATION_EXPERIMENT: ExperimentConfig = {
  enabled: process.env.GAMIFICATION_EXPERIMENT_ENABLED === 'true',
  name: 'gamification_impact',
  variants: ['control', 'basic', 'full'],
  weights: [20, 40, 40], // 20% control, 40% basic, 40% full
};

// ============================================================
// 实验服务
// ============================================================

class GamificationExperimentService {
  private config = GAMIFICATION_EXPERIMENT;
  private cache = new Map<string, GamificationVariant>();

  /**
   * 获取用户的实验变体
   */
  async getUserVariant(userId: string): Promise<GamificationVariant> {
    if (!this.config.enabled) {
      return 'full'; // 默认完整版
    }

    // 检查缓存
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    // 检查数据库
    const profile = await prisma.playerProfile.findUnique({
      where: { userId },
    });

    if (profile?.theme) {
      // 使用theme字段存储实验变体信息
      // adventure = control, sci-fi = basic, fantasy = full
      const variant = this.themeToVariant(profile.theme);
      this.cache.set(userId, variant);
      return variant;
    }

    // 新分配
    const variant = await this.assignUser(userId);
    return variant;
  }

  /**
   * 检查用户是否可以使用游戏化功能
   */
  async isGamificationEnabled(userId: string): Promise<boolean> {
    const variant = await this.getUserVariant(userId);
    return variant !== 'control';
  }

  /**
   * 检查用户是否可以使用特定功能
   */
  async canUseFeature(
    userId: string,
    feature: 'leaderboard' | 'achievements' | 'streaks'
  ): Promise<boolean> {
    const variant = await this.getUserVariant(userId);

    switch (feature) {
      case 'leaderboard':
        return variant === 'full';
      case 'achievements':
        return variant === 'full';
      case 'streaks':
        return variant === 'basic' || variant === 'full';
      default:
        return false;
    }
  }

  /**
   * 记录实验指标
   */
  async trackMetric(
    userId: string,
    metricName: string,
    value: number
  ): Promise<void> {
    if (!this.config.enabled) return;

    const variant = await this.getUserVariant(userId);

    // 存储在PlayerProfile的某个扩展字段中
    // 简化实现：只记录到日志
    console.log(`[Experiment] User ${userId} (${variant}): ${metricName} = ${value}`);
  }

  /**
   * 获取实验结果
   */
  async getExperimentResults(): Promise<{
    variants: {
      name: GamificationVariant;
      users: number;
      avgLE: number;
      avgAccuracy: number;
    }[];
  }> {
    // 统计各变体的用户数
    const themes = await prisma.playerProfile.groupBy({
      by: ['theme'],
      _count: { userId: true },
    });

    const variantStats = await Promise.all(
      this.config.variants.map(async (variant) => {
        const theme = this.variantToTheme(variant);
        const themeGroup = themes.find((t) => t.theme === theme);

        // 获取该变体的用户并计算平均LE
        const userIds = await prisma.playerProfile.findMany({
          where: { theme },
          select: { userId: true },
          take: 100,
        });

        const leRecords = await prisma.rLTrainingLog.findMany({
          where: {
            userId: { in: userIds.map((u) => u.userId) },
            leDelta: { not: null },
          },
          select: { leDelta: true },
        });

        const avgLE =
          leRecords.length > 0
            ? leRecords.reduce((sum, r) => sum + (r.leDelta || 0), 0) / leRecords.length
            : 0;

        return {
          name: variant,
          users: themeGroup?._count.userId || 0,
          avgLE,
          avgAccuracy: 0, // 简化
        };
      })
    );

    return {
      variants: variantStats,
    };
  }

  /**
   * 将theme转换为variant
   */
  private themeToVariant(theme: string): GamificationVariant {
    switch (theme) {
      case 'adventure':
        return 'control';
      case 'sci-fi':
        return 'basic';
      case 'fantasy':
      case 'sports':
      default:
        return 'full';
    }
  }

  /**
   * 将variant转换为theme
   */
  private variantToTheme(variant: GamificationVariant): string {
    switch (variant) {
      case 'control':
        return 'adventure';
      case 'basic':
        return 'sci-fi';
      case 'full':
      default:
        return 'fantasy';
    }
  }

  /**
   * 为用户分配实验变体
   */
  private async assignUser(userId: string): Promise<GamificationVariant> {
    // 加权随机分配
    const variant = this.weightedRandom(this.config.variants, this.config.weights);
    const theme = this.variantToTheme(variant);

    // 创建或更新PlayerProfile
    await prisma.playerProfile.upsert({
      where: { userId },
      create: {
        userId,
        theme,
      },
      update: {
        theme,
      },
    });

    this.cache.set(userId, variant);
    return variant;
  }

  /**
   * 加权随机选择
   */
  private weightedRandom<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }
}

// ============================================================
// 单例导出
// ============================================================

export const gamificationExperiment = new GamificationExperimentService();
