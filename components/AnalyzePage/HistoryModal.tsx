'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../MaterialIcon';

interface Attempt {
  id: string;
  mode: string;
  score: number;
  duration: number;
  completedAt: string | null;
  steps: Array<{
    stepNumber: number;
    isCorrect: boolean;
    duration: number;
  }>;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/practice/history?mode=training&limit=100');
      const data = await res.json();
      if (data.attempts) {
        setAttempts(data.attempts);
      }
    } catch (err) {
      console.error('加载练习记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '进行中';
    const date = new Date(dateStr);
    const now = new Date();
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Modal content - bottom sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="fixed inset-x-0 bottom-0 top-16 z-50 bg-surface rounded-t-3xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant/10">
              <button onClick={onClose} className="p-2 -ml-2">
                <MaterialIcon icon="arrow_back" className="text-on-surface" style={{ fontSize: '24px' }} />
              </button>
              <h2 className="font-display font-bold text-on-surface">练习记录</h2>
              <button
                onClick={() => router.push('/practice')}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium"
              >
                开始练习
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <p className="font-medium text-on-surface-variant">加载中...</p>
                </div>
              ) : attempts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                    <MaterialIcon icon="history" className="text-on-surface-variant" style={{ fontSize: '40px' }} />
                  </div>
                  <p className="text-on-surface-variant">暂无练习记录</p>
                  <button
                    onClick={() => router.push('/practice')}
                    className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
                  >
                    开始练习
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.map((attempt, index) => {
                    const correctCount = attempt.steps.filter(s => s.isCorrect).length;
                    const totalCount = attempt.steps.length;
                    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

                    return (
                      <motion.div
                        key={attempt.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-surface-container-low rounded-2xl p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-on-surface-variant">
                            {formatDate(attempt.completedAt)}
                          </span>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                            accuracy >= 80 ? 'bg-primary-container text-on-primary-container' :
                            accuracy >= 60 ? 'bg-secondary-container text-on-secondary-container' :
                            'bg-error-container text-on-error-container'
                          }`}>
                            {accuracy}%
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-on-surface-variant">
                            正确: {correctCount}/{totalCount}
                          </span>
                          <span className="text-on-surface-variant">
                            时长: {formatDuration(attempt.duration)}
                          </span>
                          <span className="font-bold text-primary">{attempt.score}分</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}