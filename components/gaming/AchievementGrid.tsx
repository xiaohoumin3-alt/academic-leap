'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Achievement } from '@/types/gaming';

/**
 * 预定义成就列表
 */
const ACHIEVEMENT_LIST = [
  { code: 'streak-3', name: '状态来了', description: '达成3连胜', icon: '🔥', rarity: 'common' as const },
  { code: 'streak-5', name: '势不可挡', description: '达成5连胜', icon: '⚡', rarity: 'rare' as const },
  { code: 'streak-10', name: '超神模式', description: '达成10连胜', icon: '👑', rarity: 'epic' as const },
  { code: 'first-win', name: '初入学院', description: '答对第一道题', icon: '🌟', rarity: 'common' as const },
  { code: 'knowledge-10', name: '知识探险家', description: '解锁10个知识点', icon: '🗺️', rarity: 'rare' as const },
  { code: 'early-bird', name: '早起鸟', description: '8点前完成10题', icon: '🌅', rarity: 'common' as const },
];

const RARITY_COLORS = {
  common: { border: 'border-gray-500', badge: 'bg-gray-500/20 text-gray-400', text: 'text-gray-400' },
  rare: { border: 'border-blue-500', badge: 'bg-blue-500/20 text-blue-400', text: 'text-blue-400' },
  epic: { border: 'border-purple-500', badge: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
  legendary: { border: 'border-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', text: 'text-yellow-400' },
};

const RARITY_LABELS = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

interface AchievementGridProps {
  unlockedCodes?: string[];
  onUnlock?: (achievement: Achievement) => void;
}

export function AchievementGrid({ unlockedCodes = [], onUnlock }: AchievementGridProps) {
  const [showUnlock, setShowUnlock] = useState<typeof ACHIEVEMENT_LIST[0] | null>(null);
  const unlockedSet = new Set(unlockedCodes);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ACHIEVEMENT_LIST.map((achievement) => {
          const isUnlocked = unlockedSet.has(achievement.code);
          const rarity = RARITY_COLORS[achievement.rarity];

          return (
            <motion.div
              key={achievement.code}
              whileHover={{ scale: 1.05 }}
              className={`
                relative p-4 rounded-xl border-2 transition-all
                ${isUnlocked ? rarity.border : 'border-white/10 opacity-50'}
              `}
            >
              {/* 图标 */}
              <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
                {achievement.icon}
              </div>

              {/* 名称 */}
              <div className={`font-bold text-sm mb-1 ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                {achievement.name}
              </div>

              {/* 描述 */}
              <div className="text-xs text-white/60">
                {achievement.description}
              </div>

              {/* 稀有度标签 */}
              <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${rarity.badge}`}>
                {RARITY_LABELS[achievement.rarity]}
              </div>

              {/* 未解锁遮罩 */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <span className="text-2xl">🔒</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 解锁动画 */}
      <AnimatePresence>
        {showUnlock && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-8 text-center border-2 border-yellow-500/50">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-4"
              >
                🏆
              </motion.div>
              <div className="text-2xl font-bold text-white mb-2">
                新成就解锁！
              </div>
              <div className={`text-xl mb-2 ${RARITY_COLORS[showUnlock.rarity].text}`}>
                [{showUnlock.name}]
              </div>
              <div className="text-sm text-white/60">
                {showUnlock.description}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
