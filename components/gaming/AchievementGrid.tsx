'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface UserAchievement {
  type: string;
  name: string;
  description: string;
  unlockedAt: Date | string;  // API returns string
  progress: number;
  maxProgress: number;
}

/**
 * 安全地解析 unlockedAt 为 Date 对象
 */
function parseUnlockedAt(unlockedAt: Date | string): Date {
  if (unlockedAt instanceof Date) return unlockedAt;
  return new Date(unlockedAt);
}

/**
 * 稀有度颜色配置
 */
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

/**
 * 根据成就类型推断稀有度
 */
function getRarityByType(type: string): keyof typeof RARITY_COLORS {
  if (type.includes('legend')) return 'legendary';
  if (type.includes('master')) return 'epic';
  if (type.includes('explorer') || type.includes('demon')) return 'rare';
  return 'common';
}

/**
 * 根据成就类型获取图标
 */
function getIconByType(type: string): string {
  const iconMap: Record<string, string> = {
    'streak_master': '🔥',
    'streak_legend': '⚡',
    'knowledge_explorer': '🗺️',
    'knowledge_master': '📚',
    'early_bird': '🌅',
    'night_owl': '🦉',
    'consistency_king': '👑',
    'speed_demon': '💨',
    'perfect_day': '⭐',
  };
  return iconMap[type] || '🏆';
}

interface AchievementGridProps {
  onUnlock?: (achievement: UserAchievement) => void;
}

export function AchievementGrid({ onUnlock }: AchievementGridProps) {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [showUnlock, setShowUnlock] = useState<UserAchievement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAchievements();
  }, []);

  const loadAchievements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gaming/achievements');
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-6">
        <div className="animate-pulse text-white/60">加载中...</div>
      </div>
    );
  }

  // 显示前6个成就
  const displayAchievements = achievements.slice(0, 6);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {displayAchievements.map((achievement) => {
          const isUnlocked = parseUnlockedAt(achievement.unlockedAt).getTime() > 0;
          const rarity = getRarityByType(achievement.type);
          const rarityConfig = RARITY_COLORS[rarity];
          const icon = getIconByType(achievement.type);
          const progress = Math.min(100, (achievement.progress / achievement.maxProgress) * 100);

          return (
            <motion.div
              key={achievement.type}
              whileHover={{ scale: 1.05 }}
              className={`
                relative p-4 rounded-xl border-2 transition-all
                ${isUnlocked ? rarityConfig.border : 'border-white/10 opacity-60'}
              `}
            >
              {/* 图标 */}
              <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>
                {icon}
              </div>

              {/* 名称 */}
              <div className={`font-bold text-sm mb-1 ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                {achievement.name}
              </div>

              {/* 描述 */}
              <div className="text-xs text-white/60 mb-2">
                {achievement.description}
              </div>

              {/* 进度条 */}
              {!isUnlocked && (
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              )}

              {/* 进度文本 */}
              {!isUnlocked && (
                <div className="text-xs text-white/40 mt-1">
                  {achievement.progress}/{achievement.maxProgress}
                </div>
              )}

              {/* 稀有度标签 */}
              <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${rarityConfig.badge}`}>
                {RARITY_LABELS[rarity]}
              </div>

              {/* 未解锁遮罩 */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
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
              <div className="text-xl mb-2 text-yellow-400">
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
