/**
 * Gamification Constants
 *
 * 游戏化系统配置常量
 */

// ============================================================
// XP 计算常量
// ============================================================

export const XP_CONSTANTS = {
  BASE_XP: 10, // 每题基础XP
  LE_MULTIPLIER: 50, // LE加成系数
  CORRECT_BONUS: 5, // 答对加成
  MIN_XP: 0, // 最小XP
} as const;

// ============================================================
// 暴击系统常量
// ============================================================

export const CRITICAL_HIT_CONSTANTS = {
  BASE_RATE: 0.1, // 基础暴击率 10%
  DOUBLE_RATE: 0.05, // 双倍暴击率 5%
  JACKPOT_RATE: 0.01, // 三倍暴击率 1%
  MULTIPLIERS: {
    LUCKY_STREAK: 1.5,
    DOUBLE_LUCKY: 2.0,
    JACKPOT: 3.0,
  },
} as const;

// ============================================================
// 连胜常量
// ============================================================

export const STREAK_CONSTANTS = {
  LE_THRESHOLD: parseFloat(process.env.LE_STREAK_THRESHOLD || '0.15'), // 连胜LE阈值
  ACHIEVEMENT_LEVELS: {
    MASTER: 5, // 连胜大师
    LEGEND: 10, // 连胜传说
  },
} as const;

// ============================================================
// 成就常量
// ============================================================

export const ACHIEVEMENT_CONSTANTS = {
  KNOWLEDGE_LEVELS: {
    EXPLORER: 20,
    MASTER: 50,
  },
  TIME_TARGETS: {
    EARLY_BIRD_HOUR: 8,
    NIGHT_OWL_HOUR: 20,
    COUNT: 10,
  },
  CONSISTENCY_DAYS: 7,
  SPEED_TARGET_SECONDS: 15,
  SPEED_COUNT: 10,
  PERFECT_DAY_MIN_QUESTIONS: 10,
} as const;

// ============================================================
// 家长控制常量
// ============================================================

export const PARENTAL_CONTROL_CONSTANTS = {
  DEFAULT_DAILY_XP_CAP: 500,
  MAX_DAILY_XP_CAP: 5000,
  DEFAULT_TIME_START: '08:00',
  DEFAULT_TIME_END: '21:00',
  DEFAULT_REWARD_THRESHOLD: 100,
} as const;

// ============================================================
// 排行榜常量
// ============================================================

export const LEADERBOARD_CONSTANTS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  CACHE_TTL_SECONDS: 300, // 5分钟
} as const;

// ============================================================
// 速率限制常量
// ============================================================

export const RATE_LIMIT_CONSTANTS = {
  GAMING_EVENT: {
    WINDOW_MS: 60000, // 1分钟
    MAX_REQUESTS: 10,
  },
  LEADERBOARD: {
    WINDOW_MS: 60000,
    MAX_REQUESTS: 30,
  },
} as const;

// ============================================================
// 主题配置
// ============================================================

export const THEMES = {
  adventure: { name: '冒险', icon: '🗺️' },
  sciFi: { name: '科幻', icon: '🚀' },
  fantasy: { name: '奇幻', icon: '⚔️' },
  sports: { name: '运动', icon: '⚽' },
} as const;

// ============================================================
// 实验配置
// ============================================================

export const EXPERIMENT_CONSTANTS = {
  WEIGHTS: {
    CONTROL: 20, // control组权重
    BASIC: 40, // basic组权重
    FULL: 40, // full组权重
  },
  THEME_MAPPING: {
    control: 'adventure',
    basic: 'sci-fi',
    full: 'fantasy',
  },
} as const;
