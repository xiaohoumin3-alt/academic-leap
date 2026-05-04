/**
 * 复测评场景2 - 练习达成触发
 *
 * 功能：检测用户练习表现，当滑动窗口20题正确率>=90%时触发复测评提示
 */

import { redis, evalLua, lrange, del } from '../redis';

/**
 * 练习记录类型
 */
export interface PracticeRecord {
  questionId: string;
  isCorrect: boolean;
  timestamp: number;
}

/**
 * 检测结果类型
 */
export interface PracticeAchievementResult {
  achieved: boolean;
  correctRate?: number;
  windowQuestionCount?: number;
  isWindowFresh?: boolean;
  daysSinceLastQuestion?: number;
}

/**
 * Redis滑动窗口TTL：30天
 */
const WINDOW_TTL = 30 * 24 * 3600;

/**
 * 新鲜度阈值：7天
 */
const FRESHNESS_THRESHOLD_DAYS = 7;

/**
 * 滑动窗口大小：20题
 */
const WINDOW_SIZE = 20;

/**
 * 正确率阈值：90%
 */
const ACCURACY_THRESHOLD = 0.9;

/**
 * Lua脚本：原子操作添加记录并修剪窗口
 *
 * 操作：
 * 1. LPUSH：添加新记录到列表头部
 * 2. LTRIM：保留最近20条记录
 * 3. EXPIRE：设置30天TTL
 */
const ADD_RECORD_SCRIPT = `
  redis.call('LPUSH', KEYS[1], ARGV[1])
  redis.call('LTRIM', KEYS[1], 0, ${WINDOW_SIZE - 1})
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return 1
`;

/**
 * 添加练习记录到滑动窗口
 *
 * @param userId - 用户ID
 * @param record - 练习记录
 */
export async function addPracticeRecord(
  userId: string,
  record: PracticeRecord
): Promise<void> {
  const key = `user:${userId}:practice:window`;

  await evalLua({
    keys: [key],
    arguments: [JSON.stringify(record), WINDOW_TTL.toString()]
  });
}

/**
 * 检测练习是否达成复测评条件
 *
 * 条件：
 * 1. 滑动窗口至少20题
 * 2. 正确率 >= 90%
 * 3. 窗口内最后一题在7天内（新鲜度检查）
 *
 * @param userId - 用户ID
 * @returns 检测结果
 */
export async function checkPracticeAchievement(
  userId: string
): Promise<PracticeAchievementResult> {
  const key = `user:${userId}:practice:window`;

  // 获取滑动窗口所有记录
  const window = await lrange(key, 0, -1);

  // 窗口少于20题，未达成
  if (window.length < WINDOW_SIZE) {
    return {
      achieved: false,
      windowQuestionCount: window.length
    };
  }

  // 取最近20题：LPUSH将新项添加到头部，所以前20项就是最新的
  const recent20 = window.slice(0, WINDOW_SIZE);

  // 新鲜度检查：最新题（recent20[0]）必须在7天内
  const newestTimestamp = recent20[0].timestamp;
  const daysSinceLastQuestion = (Date.now() - newestTimestamp) / (1000 * 60 * 60 * 24);

  if (daysSinceLastQuestion > FRESHNESS_THRESHOLD_DAYS) {
    // 窗口过期，清空数据
    await del(key);
    return {
      achieved: false,
      windowQuestionCount: window.length,
      isWindowFresh: false,
      daysSinceLastQuestion
    };
  }

  // 计算正确率
  const correctCount = recent20.filter((r) => r.isCorrect).length;
  const correctRate = correctCount / WINDOW_SIZE;

  return {
    achieved: correctRate >= ACCURACY_THRESHOLD,
    correctRate,
    windowQuestionCount: window.length,
    isWindowFresh: true,
    daysSinceLastQuestion
  };
}

/**
 * 清空用户的练习窗口
 *
 * @param userId - 用户ID
 */
export async function clearPracticeWindow(userId: string): Promise<void> {
  const key = `user:${userId}:practice:window`;
  await del(key);
}

/**
 * 获取用户当前的滑动窗口数据
 *
 * @param userId - 用户ID
 * @returns 练习记录数组
 */
export async function getPracticeWindow(
  userId: string
): Promise<PracticeRecord[]> {
  const key = `user:${userId}:practice:window`;
  return await lrange(key, 0, -1);
}
