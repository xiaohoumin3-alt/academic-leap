/**
 * Rate Limiter - 速率限制器
 *
 * 防止API滥用，特别是防止刷XP
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ============================================================
// 速率限制配置
// ============================================================

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  gaming_post: { windowMs: 60000, maxRequests: 10 }, // 游戏化事件：每分钟10次
  gaming_leaderboard: { windowMs: 60000, maxRequests: 30 }, // 排行榜：每分钟30次
};

// ============================================================
// 内存存储（生产环境应使用Redis）
// ============================================================

class RateLimiter {
  private requests = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每分钟清理过期记录
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 检查速率限制
   */
  async check(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // 获取用户的请求记录
    let timestamps = this.requests.get(key) || [];

    // 清除过期记录
    timestamps = timestamps.filter((t) => t > windowStart);

    // 检查是否超过限制
    const allowed = timestamps.length < config.maxRequests;

    if (allowed) {
      // 记录本次请求
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }

    // 计算重置时间
    const oldestTimestamp = timestamps[0] || now;
    const resetAt = new Date(oldestTimestamp + config.windowMs);

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - timestamps.length),
      resetAt,
    };
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1小时前

    for (const [key, timestamps] of this.requests.entries()) {
      // 移除1小时前没有活动的记录
      const latest = timestamps[timestamps.length - 1];
      if (latest && latest < hourAgo) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * 重置用户的速率限制（管理员功能）
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
}

// ============================================================
// 单例导出
// ============================================================

export const rateLimiter = new RateLimiter();

/**
 * 速率限制中间件工厂
 */
export function createRateLimitMiddleware(
  keyPrefix: string,
  config: RateLimitConfig
) {
  return async (userId: string): Promise<RateLimitResult> => {
    const key = `${keyPrefix}:${userId}`;
    return await rateLimiter.check(key, config);
  };
}
