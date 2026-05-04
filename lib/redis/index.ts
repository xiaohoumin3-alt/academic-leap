/**
 * Redis客户端模块
 * 用于滑动窗口、会话缓存等
 */

import { Redis } from 'ioredis';

// Redis连接单例
let redisClient: Redis | null = null;

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

// 用于测试的mock导出
export const __testing__ = {
  resetClient: () => {
    redisClient = null;
  }
};
