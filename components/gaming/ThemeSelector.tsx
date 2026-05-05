'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useGamingStore } from '@/lib/stores/gaming-store';
import { THEMES } from '@/lib/gaming/constants';

export function ThemeSelector() {
  const activeThemeId = useGamingStore((state) => state.activeThemeId);
  const setTheme = useGamingStore((state) => state.setTheme);

  const handleSelect = async (themeId: string) => {
    // 更新本地状态
    setTheme(themeId as any);

    // 同步到后端
    try {
      await fetch('/api/gaming', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeId }),
      });
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.values(THEMES).map((theme) => {
        const isActive = activeThemeId === theme.id;

        return (
          <motion.button
            key={theme.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect(theme.id)}
            className={`
              relative p-4 rounded-xl border-2 transition-all text-left
              ${isActive
                ? 'border-current bg-current/20'
                : 'border-white/10 bg-white/5 hover:border-white/20'}
            `}
            style={{
              backgroundColor: isActive ? theme.colors.surface + '40' : undefined,
              borderColor: isActive ? theme.colors.primary : undefined,
              color: isActive ? theme.colors.primary : undefined,
            }}
          >
            <div className="text-4xl mb-2">{theme.icon}</div>
            <div className="font-bold text-white">{theme.displayName}</div>
            <div className="text-xs text-white/60 mt-1">{theme.description}</div>

            {isActive && (
              <motion.div
                layoutId="activeTheme"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
                style={{ backgroundColor: theme.colors.primary }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}