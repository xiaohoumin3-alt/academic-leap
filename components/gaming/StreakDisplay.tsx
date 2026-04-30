'use client';

import React from 'react';
import { motion } from 'motion/react';
import { useGamingStore } from '@/lib/stores/gaming-store';

export function StreakDisplay() {
  const streak = useGamingStore((state) => state.streak);

  if (streak.current === 0 && !streak.isInRebound) {
    return null;
  }

  const getStreakEmoji = (count: number) => {
    if (count >= 10) return '👑';
    if (count >= 5) return '⚡';
    if (count >= 3) return '🔥';
    return '✨';
  };

  return (
    <div className="flex items-center gap-3">
      {/* 当前连胜 */}
      <motion.div
        key={streak.current}
        initial={{ scale: 1.5 }}
        animate={{ scale: 1 }}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full
          ${streak.isInRebound
            ? 'bg-blue-500/20 border border-blue-500/50'
            : streak.current >= 5
              ? 'bg-purple-500/20 border border-purple-500/50'
              : 'bg-orange-500/20 border border-orange-500/50'}
        `}
      >
        <span className="text-2xl">{getStreakEmoji(streak.current)}</span>
        <div className="text-center">
          <div className="text-white font-bold text-lg">
            {streak.isInRebound ? '反弹中' : streak.current}
          </div>
          <div className="text-xs text-white/60">
            {streak.isInRebound ? `${streak.current}/3` : '连胜'}
          </div>
        </div>
      </motion.div>

      {/* 最佳记录 */}
      {streak.best > 0 && (
        <div className="text-sm text-white/60">
          最佳: {streak.best}
        </div>
      )}
    </div>
  );
}
