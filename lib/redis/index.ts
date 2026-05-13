/**
 * Redis客户端模块
 * 用于滑动窗口、会话缓存等
 * 支持降级策略: Redis 连接失败时自动降级到 fallback
 */

import { Redis } from 'ioredis';

// Redis连接单例
let redisClient: Redis | null = null;
// Redis 可用状态
let redisAvailable = true;

/**
 * 获取Redis客户端实例
 */
export function getRedis(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
    });

    redisClient.on('ready', () => {
      redisAvailable = true;
    });
  }

  return redisClient;
}

/**
 * 导出默认客户端实例
 */
export const redis = getRedis();

/**
 * Redis命令类型
 */
export type RedisCommand = 'eval' | 'lrange' | 'del' | 'expire' | 'lpush' | 'ltrim' | 'setex';

/**
 * 执行Lua脚本
 */
export async function evalLua(
  script: string,
  options: {
    keys: string[];
    arguments: (string | number)[];
  }
): Promise<any> {
  return redis.eval(script, options.keys.length, ...options.keys, ...options.arguments);
}

/**
 * 获取列表范围内的元素
 */
export async function lrange(
  key: string,
  start: number,
  stop: number
): Promise<any[]> {
  const data = await redis.lrange(key, start, stop);
  return data.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  });
}

/**
 * 删除键
 */
export async function del(key: string): Promise<number> {
  return redis.del(key);
}

/**
 * 设置过期时间
 */
export async function expire(key: string, seconds: number): Promise<boolean> {
  const result = await redis.expire(key, seconds);
  return result === 1;
}

/**
 * 关闭Redis连接
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// ============ 降级策略相关函数 (P1 HIGH) ============

/**
 * 检查 Redis 是否可用
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * 智能获取函数 - 带降级策略
 *
 * @param key 缓存键
 * @param fallback 降级函数，当 Redis 不可用或缓存不存在时调用
 * @returns 缓存数据或 fallback 结果
 *
 * @example
 * const data = await smartGet('user:123', async () => {
 *   return await db.users.findUnique({ where: { id: '123' } });
 * });
 */
export async function smartGet<T>(
  key: string,
  fallback: () => Promise<T>
): Promise<T> {
  // 如果 Redis 不可用，直接使用 fallback
  if (!redisAvailable) {
    return fallback();
  }

  try {
    const value = await redis.get(key);

    // 缓存不存在，使用 fallback
    if (value === null || value === undefined) {
      const result = await fallback();

      // 尝试缓存结果 (不阻塞)
      cacheResult(key, result).catch(() => {
        // 忽略缓存错误
      });

      return result;
    }

    // 解析缓存数据
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  } catch (error) {
    // Redis 操作失败，启用降级
    console.error('Redis operation failed, using fallback:', error);
    redisAvailable = false;
    return fallback();
  }
}

/**
 * 缓存结果到 Redis (异步，不阻塞主流程)
 */
async function cacheResult(key: string, value: any): Promise<void> {
  if (!redisAvailable) return;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.set(key, serialized);
  } catch (error) {
    // 忽略缓存错误
    console.error('Failed to cache result:', error);
  }
}

/**
 * 带降级策略的函数包装器
 *
 * @param originalFn 原始函数 (使用 Redis)
 * @param fallbackFn 降级函数 (不使用 Redis)
 * @returns 包装后的函数
 *
 * @example
 * const getCachedData = withRedisFallback(
 *   async (key) => JSON.parse(await redis.get(key)),
 *   async (key) => await db.get(key)
 * );
 */
export function withRedisFallback<T>(
  originalFn: (key: string) => Promise<T>,
  fallbackFn: (key: string) => Promise<T>
): (key: string) => Promise<T> {
  return async (key: string): Promise<T> => {
    if (!redisAvailable) {
      return fallbackFn(key);
    }

    try {
      return await originalFn(key);
    } catch (error) {
      console.error('Redis fallback triggered:', error);
      redisAvailable = false;
      return fallbackFn(key);
    }
  };
}

// 用于测试的mock导出
export const __testing__ = {
  resetClient: () => {
    redisClient = null;
    redisAvailable = true;
  },
  setAvailable: (available: boolean) => {
    redisAvailable = available;
  }
};
