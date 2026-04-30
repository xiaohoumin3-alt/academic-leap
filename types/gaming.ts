/**
 * Gamification Types - 游戏化类型定义
 */

/**
 * 主题ID
 */
export type ThemeId = 'magic-academy' | 'career' | 'racing' | 'detective';

/**
 * 主题配置
 */
export interface ThemeConfig {
  id: ThemeId;
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
    player: string;
    level: string;
    progress: string;
  };
}

/**
 * 连胜状态
 */
export interface StreakState {
  current: number;
  best: number;
  isInRebound: boolean;
}

/**
 * 反馈类型
 */
export type FeedbackType =
  | 'correct'
  | 'wrong'
  | 'streak-3'
  | 'streak-5'
  | 'streak-10'
  | 'rebound'
  | 'critical'
  | 'achievement';

/**
 * 反馈配置
 */
export interface FeedbackConfig {
  type: FeedbackType;
  emoji: string;
  message: string;
  color: string;
  duration: number;
}

/**
 * 暴击结果
 */
export interface CriticalHitResult {
  isCritical: boolean;
  multiplier: number;
  animation: 'normal' | 'rare' | 'epic' | 'legendary';
}

/**
 * 成就
 */
export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
}

/**
 * 排行榜条目
 */
export interface LeaderboardEntry {
  rank: number;
  userName: string;
  totalXP: number;
  level: number;
  theme: string;
}

/**
 * 玩家档案
 */
export interface PlayerProfile {
  userId: string;
  totalXP: number;
  level: number;
  theme: ThemeId;
  streak: StreakState;
  achievements: Achievement[];
}
