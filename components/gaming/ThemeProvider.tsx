'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useGamingStore } from '@/lib/stores/gaming-store';
import type { ThemeId, ThemeConfig } from '@/types/gaming';

/**
 * 主题配置
 */
const THEMES: Record<ThemeId, ThemeConfig> = {
  'magic-academy': {
    id: 'magic-academy',
    name: 'magic-academy',
    displayName: '魔法学院',
    description: '像哈利波特一样学习',
    icon: '🎓',
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      background: '#1a1a2e',
      surface: '#302b63',
    },
    terminology: {
      player: '魔法学徒',
      level: '学院等级',
      progress: '魔法值',
    },
  },
  'career': {
    id: 'career',
    name: 'career',
    displayName: '职业养成',
    description: '提前体验职业，建立目标感',
    icon: '💼',
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#22c55e',
      background: '#0f172a',
      surface: '#1e293b',
    },
    terminology: {
      player: '职业学徒',
      level: '职业等级',
      progress: '经验值',
    },
  },
  'racing': {
    id: 'racing',
    name: 'racing',
    displayName: '极限竞速',
    description: '竞技体育精神，目标感和拼搏',
    icon: '🏎️',
    colors: {
      primary: '#ef4444',
      secondary: '#f97316',
      accent: '#eab308',
      background: '#18181b',
      surface: '#27272a',
    },
    terminology: {
      player: '赛车手',
      level: '赛车等级',
      progress: '加速',
    },
  },
  'detective': {
    id: 'detective',
    name: 'detective',
    displayName: '特工行动',
    description: '智力挑战，培养专注力和反应',
    icon: '🕵️',
    colors: {
      primary: '#06b6d4',
      secondary: '#0891b2',
      accent: '#14b8a6',
      background: '#0f172a',
      surface: '#1e293b',
    },
    terminology: {
      player: '特工学员',
      level: '特工等级',
      progress: '情报',
    },
  },
};

interface ThemeContextValue {
  theme: ThemeConfig;
  themeId: ThemeId;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const activeThemeId = useGamingStore((state) => state.activeThemeId);

  const value = useMemo(() => ({
    theme: THEMES[activeThemeId],
    themeId: activeThemeId,
  }), [activeThemeId]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export { THEMES };