# 游戏化系统常量 (Gamification Constants)

**Last Updated:** 2026-04-30

## 常量文件结构

### lib/gaming/constants.ts

所有游戏化相关的配置常量集中管理于此文件。

## 核心配置

### 等级与经验 (Level & Experience)

```typescript
// 等级配置
export const LEVEL_CONFIG = {
  BASE_EXP: 1000,           // 基础经验值
  EXP_MULTIPLIER: 1.5,      // 每级经验倍数
  MAX_LEVEL: 100,           // 最大等级
} as const;

// 经验获得规则
export const EXP_RULES = {
  // 基础经验获得
  BASIC_COMPLETION: 50,     // 完成练习基础经验
  
  // 准确率加成
  ACCURACY_BONUS: {
    PERFECT: 100,           // 100% 准确率
    EXCELLENT: 75,          // 90-99% 准确率
    GOOD: 50,               // 80-89% 准确率
    NORMAL: 25,             // 70-79% 准确率
  },
  
  // 连续学习加成
  STREAK_BONUS: {
    3: 1.2,                // 3天连续 20% 加成
    7: 1.5,                // 7天连续 50% 加成
    15: 2.0,               // 15天连续 100% 加成
    30: 3.0,               // 30天连续 200% 加成
  },
  
  // 成就解锁额外经验
  ACHIEVEMENT_BONUS: 200,   // 每个成就额外经验
} as const;
```

### 排行榜配置 (Leaderboard)

```typescript
export const LEADERBOARD_CONFIG = {
  // 排行榜类型
  TYPES: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    ALLTIME: 'alltime',
  } as const,
  
  // 默认显示数量
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  
  // 排行榜重置时间
  RESET_TIMES: {
    DAILY: '00:00:00',     // 每天重置
    WEEKLY: '00:00:00',    // 每周一重置
  },
  
  // 排名奖励
  RANK_BONUS: {
    1: 500,                // 第一名 500 经验
    2: 300,                // 第二名 300 经验
    3: 150,                // 第三名 150 经验
    TOP_10: 50,            // Top 10 50 经验
  },
} as const;
```

### 成就系统 (Achievements)

```typescript
export const ACHIEVEMENTS = {
  // 成就分类
  CATEGORIES: {
    LEARNING: 'learning',    // 学习成就
    STREAK: 'streak',       // 连续成就
    ACCURACY: 'accuracy',   // 精度成就
    EXPLORATION: 'exploration', // 探索成就
    SPECIAL: 'special',     // 特殊成就
  } as const,
  
  // 学习成就
  LEARNING: {
    FIRST_PRACTICE: {
      id: 'first_practice',
      name: '初试牛刀',
      description: '完成第一次练习',
      points: 100,
      category: 'learning',
    },
    PERFECT_SESSION: {
      id: 'perfect_session',
      name: '完美表现',
      description: '连续5题全部正确',
      points: 300,
      category: 'learning',
    },
    MASTER_TOPIC: {
      id: 'master_topic',
      name: '知识大师',
      description: '在一个知识点上达到90%以上准确率',
      points: 500,
      category: 'learning',
    },
  },
  
  // 连续成就
  STREAK: {
    THREE_DAYS: {
      id: 'three_days',
      name: '三日连击',
      description: '连续学习3天',
      points: 200,
      category: 'streak',
    },
    WEEK_WARRIOR: {
      id: 'week_warrior',
      name: '周战士',
      description: '连续学习7天',
      points: 400,
      category: 'streak',
    },
    MONTH_CHAMPION: {
      id: 'month_champion',
      name: '月冠军',
      description: '连续学习30天',
      points: 1000,
      category: 'streak',
    },
  },
  
  // 精度成就
  ACCURACY: {
    SHARP_SHOOTER: {
      id: 'sharp_shooter',
      name: '神枪手',
      description: '单次练习准确率达到100%',
      points: 250,
      category: 'accuracy',
    },
    CONSISTENT_EXCELLENT: {
      id: 'consistent_excellent',
      name: '稳定优秀',
      description: '连续10次练习准确率超过90%',
      points: 600,
      category: 'accuracy',
    },
  },
  
  // 探索成就
  EXPLORATION: {
    KNOWLEDGE_HUNTER: {
      id: 'knowledge_hunter',
      name: '知识猎人',
      description: '探索10个不同的知识点',
      points: 300,
      category: 'exploration',
    },
    DIVERSE_LEARNER: {
      id: 'diverse_learner',
      name: '多元学习者',
      description: '在5个以上知识点达到熟练',
      points: 500,
      category: 'exploration',
    },
  },
} as const;
```

### 家长控制 (Parental Control)

```typescript
export const PARENTAL_CONFIG = {
  // 默认限制
  DEFAULT_LIMITS: {
    DAILY_MINUTES: 60,      // 每日60分钟
    DAILY_PROBLEMS: 50,     // 每日50题
    WEEKLY_MINUTES: 420,    // 每周420分钟（7小时）
    START_TIME: '08:00',    // 开始时间 8:00
    END_TIME: '22:00',      // 结束时间 22:00
  },
  
  // 严格模式
  STRICT_MODE: {
    DAILY_MINUTES: 30,      // 每日30分钟
    DAILY_PROBLEMS: 30,     // 每日30题
    WEEKLY_MINUTES: 210,    // 每周210分钟（3.5小时）
    SHOW_RANKING: false,    // 不显示排名
  },
  
  // 宽松模式
  LOOSE_MODE: {
    DAILY_MINUTES: 120,    // 每日120分钟
    DAILY_PROBLEMS: 100,    // 每日100题
    WEEKLY_MINUTES: 840,    // 每周840分钟（14小时）
    SHOW_RANKING: true,     // 显示排名
  },
} as const;
```

### 监控配置 (Monitoring)

```typescript
export const MONITORING_CONFIG = {
  // 健康指标阈值
  HEALTH_THRESHOLDS = {
    LEARNING_EFFECTIVENESS: {
      target: 0.15,        // LE > 15%
      warning: 0.10,        // 警告阈值
      critical: 0.05,      // 严重阈值
    },
    CONVERGENCE_STABILITY: {
      target: 0.85,        // CS > 85%
      warning: 0.75,       // 警告阈值
      critical: 0.60,       // 严重阈值
    },
    DATA_FLOW_INTEGRITY: {
      target: 0.99,        // DFI > 99%
      warning: 0.95,       // 警告阈值
      critical: 0.90,      // 严重阈值
    },
  },
  
  // 监控间隔
  INTERVALS = {
    HEALTH_CHECK: 60 * 1000,      // 1分钟
    LEADERBOARD_UPDATE: 5 * 60 * 1000, // 5分钟
    STATS_AGGREGATION: 10 * 60 * 1000, // 10分钟
  },
  
  // 告警规则
  ALERT_RULES = {
    ERROR_RATE_THRESHOLD: 0.05,  // 错误率 > 5%
    RESPONSE_TIME_THRESHOLD: 500, // 响应时间 > 500ms
    DEAD_LETTER_THRESHOLD: 10,   // 死信队列 > 10条
  },
} as const;
```

### 实验配置 (Experiments)

```typescript
export const EXPERIMENT_CONFIG = {
  // 活跃实验
  ACTIVE_EXPERIMENTS = {
    DAILY_BONUS_AMOUNT: {
      id: 'daily_bonus_amount',
      name: '每日奖励金额',
      variants: {
        control: 50,       // 控制组 50 经验
        test_a: 100,       // 测试组A 100 经验
        test_b: 200,       // 测试组B 200 经验
      },
      traffic_split: [0.5, 0.25, 0.25], // 流量分配
    },
    ACHIEVEMENT_NOTIFICATION: {
      id: 'achievement_notification',
      name: '成就通知方式',
      variants: {
        control: 'none',   // 无通知
        test_a: 'badge',   // 徽章通知
        test_b: 'popup',   // 弹窗通知
        test_c: 'sound',   // 声音通知
      },
      traffic_split: [0.2, 0.2, 0.2, 0.4],
    },
  },
  
  // 实验统计
  EXPERIMENT_STATS = {
    MIN_SAMPLE_SIZE: 100,    // 最小样本量
    MIN_DURATION_DAYS: 7,    // 最小运行天数
    SIGNIFICANCE_LEVEL: 0.05, // 显著性水平
  },
} as const;
```

### 事件类型 (Event Types)

```typescript
export const EVENT_TYPES = {
  // 学习事件
  LEARNING: {
    PRACTICE_COMPLETED: 'practice_completed',
    PERFECT_SESSION: 'perfect_session',
    LEVEL_UP: 'level_up',
    ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  },
  
  // 错误事件
  ERROR: {
    PROCESSING_FAILED: 'processing_failed',
    VALIDATION_ERROR: 'validation_error',
    NETWORK_ERROR: 'network_error',
  },
  
  // 系统事件
  SYSTEM: {
    HEALTH_CHECK: 'health_check',
    STATS_UPDATE: 'stats_update',
    EXPERIMENT_RECORD: 'experiment_record',
  },
} as const;
```

### 错误代码 (Error Codes)

```typescript
export const ERROR_CODES = {
  // 玩家相关错误
  PLAYER: {
    NOT_FOUND: 'PLAYER_NOT_FOUND',
    ALREADY_EXISTS: 'PLAYER_ALREADY_EXISTS',
    INVALID_LEVEL: 'INVALID_LEVEL',
    INSUFFICIENT_EXPERIENCE: 'INSUFFICIENT_EXPERIENCE',
  },
  
  // 成就相关错误
  ACHIEVEMENT: {
    NOT_FOUND: 'ACHIEVEMENT_NOT_FOUND',
    ALREADY_UNLOCKED: 'ACHIEVEMENT_ALREADY_UNLOCKED',
    INVALID_CONDITION: 'INVALID_ACHIEVEMENT_CONDITION',
  },
  
  // 排行榜相关错误
  LEADERBOARD: {
    INVALID_TYPE: 'INVALID_LEADERBOARD_TYPE',
    LIMIT_EXCEEDED: 'LEADERBOARD_LIMIT_EXCEEDED',
    NO_DATA: 'LEADERBOARD_NO_DATA',
  },
  
  // 家长控制相关错误
  PARENTAL: {
    LIMIT_EXCEEDED: 'PARENTAL_LIMIT_EXCEEDED',
    TIME_RESTRICTION: 'PARENTAL_TIME_RESTRICTION',
    PRIVACY_VIOLATION: 'PARENTAL_PRIVACY_VIOLATION',
  },
  
  // 系统错误
  SYSTEM: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    RATE_LIMITED: 'RATE_LIMITED',
  },
} as const;
```

### API 限流 (Rate Limiting)

```typescript
export const RATE_LIMIT_CONFIG = {
  // API 限流
  API: {
    GAMING_ENDPOINTS: {
      windowMs: 60 * 1000,      // 1分钟窗口
      max: 30,                 // 最多30次请求
    },
    LEADERBOARD_ENDPOINTS: {
      windowMs: 5 * 60 * 1000, // 5分钟窗口
      max: 10,                 // 最多10次请求
    },
    PARENTAL_ENDPOINTS: {
      windowMs: 60 * 1000,      // 1分钟窗口
      max: 5,                  // 最多5次请求
    },
  },
  
  // 事件处理限流
  EVENT_PROCESSING: {
    MAX_CONCURRENT: 100,        // 最大并发数
    BATCH_SIZE: 50,             // 批处理大小
    RETRY_ATTEMPTS: 3,          // 重试次数
  },
} as const;
```

## 使用示例

```typescript
import { 
  LEVEL_CONFIG, 
  EXP_RULES, 
  ACHIEVEMENTS,
  EVENT_TYPES 
} from '@/lib/gaming/constants';

// 计算经验值
const calculateExperience = (accuracy: number, streakCount: number) => {
  const baseExp = EXP_RULES.BASIC_COMPLETION;
  const accuracyBonus = EXP_RULES.ACCURACY_BONUS[accuracy] || 0;
  const streakMultiplier = EXP_RULES.STREAK_BONUS[streakCount] || 1;
  
  return (baseExp + accuracyBonus) * streakMultiplier;
};

// 检查成就条件
const checkAchievement = (event: string, data: any) => {
  if (event === EVENT_TYPES.LEARNING.PRACTICE_COMPLETED) {
    if (data.accuracy === 100) {
      return ACHIEVEMENTS.LEARNING.PERFECT_SESSION;
    }
  }
  return null;
};
```

---

**Note**: 此文件应随游戏化系统更新而同步更新，确保常量的一致性。