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

export interface ThemeConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
  terminology: {
    player: string;      // "魔法学徒" | "实习生" | "赛车手" | "特工"
    level: string;       // "魔法等级" | "职级" | "段位" | "特工等级"
    challenge: string;   // "施法练习" | "任务" | "过弯" | "行动"
    reward: string;      // "魔力值" | "绩效" | "氮气" | "情报"
    boss: string;        // "魔法考试" | "重要项目" | "冠军赛" | "终极任务"
    progress: string;    // "魔力" | "经验" | "加速" | "情报"（用于显示）
  };
  feedback: {
    correct: string;
    wrong: string;
  };
}

export const THEMES: Record<string, ThemeConfig> = {
  'magic-academy': {
    id: 'magic-academy',
    name: 'magic-academy',
    displayName: '魔法学院',
    description: '像哈利波特一样学习',
    icon: '🎓',
    colors: {
      primary: '#7C3AED',
      secondary: '#A78BFA',
      accent: '#F5D0FE',
      background: '#1E1B4B',
      surface: '#302B63',
    },
    terminology: {
      player: '魔法学徒',
      level: '魔法等级',
      challenge: '施法练习',
      reward: '魔力值',
      boss: '魔法考试',
      progress: '魔力',
    },
    feedback: {
      correct: '魔力充能！',
      wrong: '魔法反噬！调整呼吸...',
    },
  },
  'career': {
    id: 'career',
    name: 'career',
    displayName: '职业养成',
    description: '提前体验职业，建立目标感',
    icon: '💼',
    colors: {
      primary: '#2563EB',
      secondary: '#64748B',
      accent: '#22C55E',
      background: '#0F172A',
      surface: '#1E293B',
    },
    terminology: {
      player: '实习生',
      level: '职级',
      challenge: '工作任务',
      reward: '绩效',
      boss: '重要项目',
      progress: '经验值',
    },
    feedback: {
      correct: '任务完成！绩效提升',
      wrong: '工作失误！复盘一下...',
    },
  },
  'racing': {
    id: 'racing',
    name: 'racing',
    displayName: '极限竞速',
    description: '竞技体育精神，目标感和拼搏',
    icon: '🏎️',
    colors: {
      primary: '#DC2626',
      secondary: '#F97316',
      accent: '#EAB308',
      background: '#18181B',
      surface: '#27272A',
    },
    terminology: {
      player: '赛车手',
      level: '段位',
      challenge: '过弯',
      reward: '氮气',
      boss: '冠军赛',
      progress: '加速',
    },
    feedback: {
      correct: '完美过弯！氮气充能',
      wrong: '失控打滑！调整角度...',
    },
  },
  'detective': {
    id: 'detective',
    name: 'detective',
    displayName: '特工行动',
    description: '智力挑战，培养专注力和反应',
    icon: '🕵️',
    colors: {
      primary: '#06B6D4',
      secondary: '#0891B2',
      accent: '#14B8A6',
      background: '#0F172A',
      surface: '#1E293B',
    },
    terminology: {
      player: '特工',
      level: '特工等级',
      challenge: '行动',
      reward: '情报',
      boss: '终极任务',
      progress: '情报',
    },
    feedback: {
      correct: '情报获取！新证据发现',
      wrong: '行动暴露！快速撤离...',
    },
  },
};

// ============================================================
// 实验配置
// ============================================================

export const EXPERIMENT_CONSTANTS = {
  WEIGHTS: {
    CONTROL: 20, // control组权重
    BASIC: 40, // basic组权重
    FULL: 40, // full组权重
  },
  // 实验与主题解耦 - 用户可以自由选择任何主题
  // 实验变体只控制游戏化功能的可用性
} as const;
