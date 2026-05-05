'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useGamingStore } from '@/lib/stores/gaming-store';
import { THEMES, type ThemeConfig } from '@/lib/gaming/constants';

interface ThemeContextValue {
  theme: ThemeConfig;
  themeId: string;
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