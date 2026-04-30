/**
 * Gaming Store - 游戏化状态管理
 *
 * 使用 Zustand 管理游戏化相关状态
 */

import { create } from 'zustand';
import type { ThemeId, StreakState, Achievement, FeedbackType, CriticalHitResult } from '@/types/gaming';

interface GamingState {
  // 主题
  activeThemeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;

  // 连胜
  streak: StreakState;
  setStreak: (streak: StreakState) => void;

  // 成就
  achievements: Achievement[];
  setAchievements: (achievements: Achievement[]) => void;

  // 积分
  totalXP: number;
  level: number;
  addXP: (amount: number) => void;

  // 音效
  soundEnabled: boolean;
  toggleSound: () => void;

  // 当前反馈
  currentFeedback: {
    type: FeedbackType;
    message: string;
    points?: number;
    criticalHit?: CriticalHitResult;
    streak?: number;
  } | null;
  showFeedback: (feedback: GamingState['currentFeedback']) => void;
  clearFeedback: () => void;
}

export const useGamingStore = create<GamingState>((set) => ({
  // 主题
  activeThemeId: 'magic-academy',
  setTheme: (themeId) => set({ activeThemeId: themeId }),

  // 连胜
  streak: { current: 0, best: 0, isInRebound: false },
  setStreak: (streak) => set({ streak }),

  // 成就
  achievements: [],
  setAchievements: (achievements) => set({ achievements }),

  // 积分
  totalXP: 0,
  level: 1,
  addXP: (amount) => set((state) => ({
    totalXP: state.totalXP + amount,
    level: Math.floor((state.totalXP + amount) / 100) + 1,
  })),

  // 音效
  soundEnabled: false,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  // 当前反馈
  currentFeedback: null,
  showFeedback: (feedback) => set({ currentFeedback: feedback }),
  clearFeedback: () => set({ currentFeedback: null }),
}));
