/**
 * Leaderboard Service - 排行榜系统
 *
 * 支持按主题和角色的排行榜
 * 使用Redis缓存提高性能
 */

import { prisma } from '@/lib/prisma';

// Redis客户端（可选）
let redisClient: any = null;

try {
  if (process.env.REDIS_URL) {
    // 动态导入redis
    const redis = await import('redis');
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
    });
    await redisClient.connect();
  }
} catch (error) {
  console.warn('[Leaderboard] Redis not available, using database only');
}

// ============================================================
// 类型定义
// ============================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalXP: number;
  level: number;
  theme: string;
  character: string;
}

export interface LeaderboardOptions {
  theme?: string; // adventure | sci-fi | fantasy | sports
  character?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// 排行榜服务
// ============================================================

class LeaderboardService {
  private CACHE_TTL = 300; // 5分钟缓存

  /**
   * 获取排行榜
   */
  async getLeaderboard(options: LeaderboardOptions = {}): Promise<{
    entries: LeaderboardEntry[];
    total: number;
  }> {
    const { theme, character, limit = 50, offset = 0 } = options;

    // 构建缓存键
    const cacheKey = this.buildCacheKey(theme, character, limit, offset);

    // 尝试从Redis获取
    if (redisClient) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 从数据库查询
    const where: any = {};
    if (theme) where.theme = theme;
    if (character) where.character = character;

    // 分两步查询避免循环依赖
    const profiles = await prisma.playerProfile.findMany({
      where,
      orderBy: { totalXP: 'desc' },
      take: limit,
      skip: offset,
      select: {
        userId: true,
        totalXP: true,
        level: true,
        theme: true,
        character: true,
      },
    });

    const [total, users] = await Promise.all([
      prisma.playerProfile.count({ where }),
      // 批量获取用户信息
      prisma.user.findMany({
        where: {
          id: { in: profiles.map((p) => p.userId) },
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    // 创建用户名映射
    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    // 转换为排行榜格式
    const entries: LeaderboardEntry[] = profiles.map((profile, index) => ({
      rank: offset + index + 1,
      userId: profile.userId,
      userName: userNameMap.get(profile.userId) || '匿名',
      totalXP: profile.totalXP,
      level: profile.level,
      theme: profile.theme,
      character: profile.character,
    }));

    const result = { entries, total };

    // 缓存结果
    if (redisClient) {
      await this.setCached(cacheKey, result);
    }

    return result;
  }

  /**
   * 获取用户排名
   *
   * 使用缓存优化排名查询
   */
  async getUserRank(userId: string, options: LeaderboardOptions = {}): Promise<{
    rank: number;
    totalParticipants: number;
  }> {
    const { theme, character } = options;

    // 构建缓存键
    const cacheKey = `rank:${userId}:${theme || 'all'}:${character || 'all'}`;

    // 尝试从缓存获取
    if (redisClient) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const where: any = {};
    if (theme) where.theme = theme;
    if (character) where.character = character;

    // 并行获取用户XP和总数
    const [userProfile, totalParticipants] = await Promise.all([
      prisma.playerProfile.findUnique({
        where: { userId },
        select: { totalXP: true },
      }),
      prisma.playerProfile.count({ where }),
    ]);

    const userXP = userProfile?.totalXP || 0;

    // 计算排名（只统计XP更高的）
    const rank = await prisma.playerProfile.count({
      where: {
        ...where,
        totalXP: { gt: userXP },
      },
    });

    const result = {
      rank: rank + 1,
      totalParticipants,
    };

    // 缓存结果（较短的TTL，因为排名会变化）
    if (redisClient) {
      await this.setCached(cacheKey, result, 60); // 1分钟缓存
    }

    return result;
  }

  /**
   * 更新用户主题/角色
   */
  async updateUserTheme(
    userId: string,
    theme: string,
    character: string
  ): Promise<void> {
    await prisma.playerProfile.upsert({
      where: { userId },
      create: {
        userId,
        theme,
        character,
      },
      update: {
        theme,
        character,
      },
    });

    // 清除相关缓存
    await this.clearCacheForUser(userId);
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(
    theme?: string,
    character?: string,
    limit?: number,
    offset?: number
  ): string {
    const parts = ['leaderboard'];
    if (theme) parts.push(theme);
    if (character) parts.push(character);
    parts.push(String(limit || 50));
    parts.push(String(offset || 0));
    return parts.join(':');
  }

  /**
   * 从Redis获取缓存
   */
  private async getCached(key: string): Promise<any> {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Leaderboard] Cache get failed:', error);
      return null;
    }
  }

  /**
   * 设置Redis缓存
   */
  private async setCached(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await redisClient.setEx(
        key,
        ttl || this.CACHE_TTL,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('[Leaderboard] Cache set failed:', error);
    }
  }

  /**
   * 清除用户相关缓存
   */
  private async clearCacheForUser(userId: string): Promise<void> {
    if (!redisClient) return;

    try {
      // 清除该用户参与的所有排行榜缓存
      const profile = await prisma.playerProfile.findUnique({
        where: { userId },
        select: { theme: true, character: true },
      });

      if (!profile) return;

      // 清除主题排行榜
      await redisClient.del(
        this.buildCacheKey(profile.theme, undefined, 50, 0)
      );

      // 清除角色排行榜
      await redisClient.del(
        this.buildCacheKey(undefined, profile.character, 50, 0)
      );
    } catch (error) {
      console.error('[Leaderboard] Cache clear failed:', error);
    }
  }

  /**
   * 刷新排行榜缓存（定时任务）
   */
  async refreshCache(): Promise<void> {
    if (!redisClient) return;

    try {
      // 刷新所有主题的排行榜
      const themes = ['adventure', 'sci-fi', 'fantasy', 'sports'];

      for (const theme of themes) {
        await this.getLeaderboard({ theme, limit: 50, offset: 0 });
      }

      console.log('[Leaderboard] Cache refreshed');
    } catch (error) {
      console.error('[Leaderboard] Cache refresh failed:', error);
    }
  }
}

// ============================================================
// 单例导出
// ============================================================

export const leaderboardService = new LeaderboardService();
