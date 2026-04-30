'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { FeedbackType, CriticalHitResult } from '@/types/gaming';

interface FeedbackAnimatorProps {
  type: FeedbackType;
  message: string;
  points?: number;
  criticalHit?: CriticalHitResult;
  streak?: number;
  duration?: number;
  onComplete?: () => void;
}

const FEEDBACK_CONFIG: Record<FeedbackType, {
  emoji: string;
  color: string;
  bg: string;
  duration: number;
}> = {
  'correct': { emoji: '✨', color: 'text-green-400', bg: 'bg-green-500/20', duration: 1500 },
  'wrong': { emoji: '💭', color: 'text-amber-400', bg: 'bg-amber-500/20', duration: 1500 },
  'streak-3': { emoji: '🔥', color: 'text-orange-400', bg: 'bg-orange-500/20', duration: 2000 },
  'streak-5': { emoji: '⚡', color: 'text-yellow-400', bg: 'bg-yellow-500/20', duration: 2500 },
  'streak-10': { emoji: '👑', color: 'text-purple-400', bg: 'bg-purple-500/20', duration: 3000 },
  'rebound': { emoji: '💪', color: 'text-blue-400', bg: 'bg-blue-500/20', duration: 2000 },
  'critical': { emoji: '💥', color: 'text-red-400', bg: 'bg-red-500/20', duration: 2000 },
  'achievement': { emoji: '🏆', color: 'text-yellow-400', bg: 'bg-yellow-500/20', duration: 3000 },
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
  const config = FEEDBACK_CONFIG[type];
  const displayDuration = duration || config.duration;

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
              ${config.bg}
              ${isCritical ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-white/10'}
            `}
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
              {isCritical ? '💥' : config.emoji}
            </motion.div>

            {/* Message */}
            <div className={`text-2xl font-bold mb-2 ${config.color}`}>
              {isCritical ? '暴击！' : message}
            </div>

            {/* Points */}
            {points !== undefined && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-white"
              >
                +{points} 积分
                {criticalHit && criticalHit.multiplier > 1 && (
                  <span className="text-yellow-400 ml-2">x{criticalHit.multiplier}</span>
                )}
              </motion.div>
            )}

            {/* Streak */}
            {streak !== undefined && streak >= 3 && (
              <div className="text-sm text-orange-400 mt-2">
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
      message="答对啦！"
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
      message="还没掌握，加油！"
      onComplete={onComplete}
    />
  );
}
