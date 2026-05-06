/**
 * Rate Limiter - 速率限制器
 * 使用 Redis 实现滑动窗口速率限制
 * 防止 API 滥用，特别是防止刷 XP
 */

import { getRedis } from './redis';

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
  forgot_password: { windowMs: 5 * 60 * 1000, maxRequests: 3 }, // 忘记密码：5分钟3次
  reset_password: { windowMs: 5 * 60 * 1000, maxRequests: 5 }, // 重置密码：5分钟5次
  ocr: { windowMs: 60000, maxRequests: 20 }, // OCR：每分钟20次
  ai_generate: { windowMs: 60000, maxRequests: 30 }, // AI生成：每分钟30次
};

// ============================================================
// Redis 滑动窗口速率限制器
// ============================================================

/**
 * 检查速率限制（Redis 实现）
 * 使用滑动窗口算法，支持多实例部署
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();
  const now = Date.now();
  const windowMs = config.windowMs;
  const windowStart = now - windowMs;

  // Lua 脚本：滑动窗口速率限制
  // 返回 [allowed (0/1), remaining, resetTime]
  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowStart = tonumber(ARGV[2])
    local maxRequests = tonumber(ARGV[3])
    local windowMs = tonumber(ARGV[4])

    -- 移除窗口外的请求
    redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

    -- 获取当前请求数
    local currentCount = redis.call('ZCARD', key)

    -- 检查是否超过限制
    if currentCount < maxRequests then
      -- 添加当前请求
      redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
      -- 设置过期时间（窗口大小 + 1）
      redis.call('PEXPIRE', key, windowMs + 1000)
      return {1, maxRequests - currentCount - 1, now + windowMs}
    else
      -- 获取最旧的请求时间
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local resetAt = oldest[2] and (tonumber(oldest[2]) + windowMs) or (now + windowMs)
      return {0, 0, resetAt}
    end
  `;

  try {
    const result = await redis.eval(
      luaScript,
      1,
      `ratelimit:${key}`,
      now,
      windowStart,
      config.maxRequests,
      windowMs
    ) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetAt: new Date(result[2]),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Redis 故障时返回允许（降级策略）
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + windowMs),
    };
  }
}

/**
 * 重置用户的速率限制（管理员功能）
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`ratelimit:${key}`);
}

/**
 * 创建速率限制中间件工厂
 */
export function createRateLimitMiddleware(
  keyPrefix: string,
  config: RateLimitConfig
) {
  return async (userId: string): Promise<RateLimitResult> => {
    return await checkRateLimit(`${keyPrefix}:${userId}`, config);
  };
}

/**
 * 获取速率限制配置
 */
export function getRateLimitConfig(name: string): RateLimitConfig | undefined {
  return RATE_LIMITS[name];
}

/**
 * 检查是否有预设的速率限制
 */
export function hasRateLimit(name: string): boolean {
  return name in RATE_LIMITS;
}