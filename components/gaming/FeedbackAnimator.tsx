'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { FeedbackType, CriticalHitResult, ThemeId } from '@/types/gaming';
import { useTheme } from './ThemeProvider';

interface FeedbackAnimatorProps {
  type: FeedbackType;
  message?: string;
  points?: number;
  criticalHit?: CriticalHitResult;
  streak?: number;
  duration?: number;
  onComplete?: () => void;
}

/**
 * 主题化反馈配置
 */
const FEEDBACK_BY_THEME: Record<string, {
  correct: { message: string; emoji: string };
  wrong: { message: string; emoji: string };
}> = {
  'magic-academy': {
    correct: { message: '魔力充能！', emoji: '✨' },
    wrong: { message: '魔法反噬！调整呼吸...', emoji: '💨' },
  },
  'career': {
    correct: { message: '任务完成！绩效提升', emoji: '💼' },
    wrong: { message: '工作失误！复盘一下...', emoji: '📋' },
  },
  'racing': {
    correct: { message: '完美过弯！氮气充能', emoji: '🏎️' },
    wrong: { message: '失控打滑！调整角度...', emoji: '💨' },
  },
  'detective': {
    correct: { message: '情报获取！新证据发现', emoji: '🕵️' },
    wrong: { message: '行动暴露！快速撤离...', emoji: '🚨' },
  },
};

const BASE_FEEDBACK_CONFIG: Record<FeedbackType, {
  color: string;
  bg: string;
  duration: number;
  emoji: string;
}> = {
  'correct': { color: 'text-green-400', bg: 'bg-green-500/20', duration: 1500, emoji: '✨' },
  'wrong': { color: 'text-amber-400', bg: 'bg-amber-500/20', duration: 1500, emoji: '💭' },
  'streak-3': { color: 'text-orange-400', bg: 'bg-orange-500/20', duration: 2000, emoji: '🔥' },
  'streak-5': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', duration: 2500, emoji: '⚡' },
  'streak-10': { color: 'text-purple-400', bg: 'bg-purple-500/20', duration: 3000, emoji: '👑' },
  'rebound': { color: 'text-blue-400', bg: 'bg-blue-500/20', duration: 2000, emoji: '💪' },
  'critical': { color: 'text-red-400', bg: 'bg-red-500/20', duration: 2000, emoji: '💥' },
  'achievement': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', duration: 3000, emoji: '🏆' },
};

export function FeedbackAnimator({
  type,
  message,
  points,
  criticalHit,
  streak,
  duration,
  onComplete,
}: FeedbackAnimatorProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { theme, themeId } = useTheme();
  const baseConfig = BASE_FEEDBACK_CONFIG[type];
  const displayDuration = duration || baseConfig.duration;

  // 获取主题化的反馈文案和图标
  const getThemedFeedback = () => {
    if (type === 'correct' || type === 'critical') {
      return FEEDBACK_BY_THEME[themeId].correct;
    }
    if (type === 'wrong') {
      return FEEDBACK_BY_THEME[themeId].wrong;
    }
    return { message: message || '', emoji: baseConfig.emoji };
  };

  const themedFeedback = getThemedFeedback();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, displayDuration);

    return () => clearTimeout(timer);
  }, [displayDuration, onComplete]);

  const isCritical = criticalHit?.isCritical && type === 'correct';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: isCritical ? 2 : 1.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
        >
          <div
            className={`
              rounded-2xl p-8 text-center backdrop-blur-sm border-2
              ${baseConfig.bg}
              ${isCritical ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-white/10'}
            `}
            style={{
              backgroundColor: isCritical
                ? undefined
                : theme.colors.surface + '40',
              borderColor: isCritical
                ? undefined
                : theme.colors.primary,
            }}
          >
            {/* Emoji */}
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                rotate: isCritical ? [0, -5, 5, -5, 0] : 0,
              }}
              transition={{ duration: 0.5, repeat: isCritical ? 1 : 0 }}
              className="text-6xl mb-4"
            >
              {isCritical ? '💥' : themedFeedback.emoji}
            </motion.div>

            {/* Message */}
            <div className={`text-2xl font-bold mb-2 ${baseConfig.color}`}>
              {isCritical ? '暴击！' : message || themedFeedback.message}
            </div>

            {/* Points */}
            {points !== undefined && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-white"
              >
                +{points} {theme.terminology.progress || '积分'}
                {criticalHit && criticalHit.multiplier > 1 && (
                  <span className="text-yellow-400 ml-2">x{criticalHit.multiplier}</span>
                )}
              </motion.div>
            )}

            {/* Streak */}
            {streak !== undefined && streak >= 3 && (
              <div className="text-sm mt-2" style={{ color: theme.colors.accent }}>
                🔥 {streak} 连胜
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 快捷组件：正确反馈
 */
export function CorrectFeedback({
  points,
  criticalHit,
  streak,
  onComplete,
}: {
  points?: number;
  criticalHit?: CriticalHitResult;
  streak?: number;
  onComplete?: () => void;
}) {
  return (
    <FeedbackAnimator
      type={criticalHit?.isCritical ? 'critical' : 'correct'}
      points={points}
      criticalHit={criticalHit}
      streak={streak}
      onComplete={onComplete}
    />
  );
}

/**
 * 快捷组件：错误反馈
 */
export function WrongFeedback({ onComplete }: { onComplete?: () => void }) {
  return (
    <FeedbackAnimator
      type="wrong"
      onComplete={onComplete}
    />
  );
}
