'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '../../../components/MaterialIcon';

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

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    fetch('/api/practice/history?limit=100')
      .then(async res => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.attempts) {
          setAttempts(data.attempts);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '进行中';
    const date = new Date(dateStr);
    const now = new Date();

    // 重置时间为 00:00:00，只比较日期
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-4 bg-surface-container-highest">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <MaterialIcon icon="arrow_back" style={{ fontSize: '24px' }} />
        </button>
        <h1 className="text-xl font-display font-bold">练习记录</h1>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-4 overflow-auto">
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
              className="mt-4 bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface-variant">
                        {attempt.mode === 'training' ? '训练模式' : '诊断模式'}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(attempt.completedAt)}
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      accuracy >= 80 ? 'bg-primary-container text-on-primary-container' :
                      accuracy >= 60 ? 'bg-secondary-container text-on-secondary-container' :
                      'bg-error-container text-on-error-container'
                    }`}>
                      {accuracy}%
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-on-surface-variant">
                        正确: {correctCount}/{totalCount}
                      </span>
                      <span className="text-on-surface-variant">
                        时长: {formatDuration(attempt.duration)}
                      </span>
                    </div>
                    <span className="font-bold text-primary">
                      {attempt.score}分
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-highest border-t border-surface-variant/20 px-6 py-3 flex justify-around items-center">
        <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="home" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">首页</span>
        </button>
        <button onClick={() => router.push('/practice')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="my_location" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">练习</span>
        </button>
        <button onClick={() => router.push('/analyze')} className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="bar_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-on-surface-variant">分析</span>
        </button>
        <button className="flex flex-col items-center gap-1 px-4 py-2">
          <MaterialIcon icon="person" className="text-primary" style={{ fontSize: '20px' }} />
          <span className="text-xs font-medium text-primary">我的</span>
        </button>
      </nav>
    </div>
  );
}
