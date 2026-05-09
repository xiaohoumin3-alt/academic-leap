'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, ClipboardCheck, TrendingUp, Target, ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodayStats {
  questionCount: number;
  accuracy: number;
  xpEarned: number;
  goal?: {
    target: number;
    current: number;
    accuracy: number;
  };
}

/**
 * ModeSelectInner - 内部组件，包含useSearchParams逻辑
 */
function ModeSelectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  const [stats, setStats] = useState<TodayStats>({
    questionCount: 0,
    accuracy: 0,
    xpEarned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // 从API获取今日统计数据
  useEffect(() => {
    async function fetchTodayStats() {
      try {
        const response = await fetch('/api/user/stats/today');
        if (!response.ok) {
          throw new Error('Failed to fetch today stats');
        }
        const data = await response.json();
        setStats({
          questionCount: data.questionCount,
          accuracy: data.accuracy,
          xpEarned: data.xpEarned,
          goal: data.goal,
        });
      } catch (error) {
        console.error('Failed to fetch today stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTodayStats();
  }, []);

  // 根据mode参数直接进入对应模式
  useEffect(() => {
    if (mode === 'training') {
      router.replace('/practice/training');
    } else if (mode === 'diagnostic') {
      router.replace('/assessment/diagnostic');
    }
  }, [mode, router]);

  const handleStartPractice = (targetMode: 'training' | 'diagnostic') => {
    // 直接跳转到目标页面
    if (targetMode === 'training') {
      router.push('/practice/training');
    } else {
      router.push('/assessment/diagnostic');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* 返回首页按钮 */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <Home className="w-5 h-5" />
        <span>返回首页</span>
      </button>

      {/* 今日学习统计卡片 */}
      <div className={cn(
        "bg-surface-container rounded-2xl p-6",
        "border border-outline/20"
      )}>
        <h4 className="text-sm font-medium text-on-surface-variant mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          今日学习
        </h4>
        {isLoading ? (
          <div className="flex justify-around">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center animate-pulse">
                <div className="w-12 h-8 bg-surface-container-high rounded mb-1" />
                <div className="w-6 h-3 bg-surface-container-high rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-2xl font-bold text-on-surface">{stats.questionCount}</div>
              <div className="text-xs text-on-surface-variant">题</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-on-surface">{stats.accuracy}%</div>
              <div className="text-xs text-on-surface-variant">正确率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-tertiary">+{stats.xpEarned}</div>
              <div className="text-xs text-on-surface-variant">XP</div>
            </div>
          </div>
        )}
      </div>

      {/* 练习模式入口 */}
      <div
        className={cn(
          "bg-surface-container rounded-2xl p-6 cursor-pointer",
          "hover:bg-surface-container-high transition-all duration-200",
          "border border-outline/20 hover:border-primary/30",
          "group"
        )}
        onClick={() => handleStartPractice('training')}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            "bg-primary-container group-hover:bg-primary/20 transition-colors"
          )}>
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
              练习模式
              <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
            </h3>
            <p className="text-sm text-on-surface-variant mb-3">
              即时反馈，深入理解每个知识点
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-secondary-container text-on-secondary-container"
              )}>
                即时反馈
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-secondary-container text-on-secondary-container"
              )}>
                自评记忆
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-tertiary-container text-on-tertiary-container"
              )}>
                XP奖励
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 诊断模式入口 */}
      <div
        className={cn(
          "bg-surface-container rounded-2xl p-6 cursor-pointer",
          "hover:bg-surface-container-high transition-all duration-200",
          "border border-outline/20 hover:border-secondary/30",
          "group"
        )}
        onClick={() => handleStartPractice('diagnostic')}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            "bg-secondary-container group-hover:bg-secondary/20 transition-colors"
          )}>
            <ClipboardCheck className="w-6 h-6 text-secondary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-on-surface mb-1 flex items-center gap-2">
              诊断测评
              <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-secondary transition-colors" />
            </h3>
            <p className="text-sm text-on-surface-variant mb-3">
              评估当前水平，生成个性化学习路径
            </p>
            <div className="flex flex-wrap gap-2">
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-tertiary-container text-on-tertiary-container"
              )}>
                能力评估
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-tertiary-container text-on-tertiary-container"
              )}>
                薄弱点定位
              </span>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "bg-tertiary-container text-on-tertiary-container"
              )}>
                学习建议
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 学习目标卡片（可选功能） */}
      <div className={cn(
        "bg-gradient-to-r from-primary-container/50 to-secondary-container/50",
        "rounded-2xl p-5",
        "border border-outline/10"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-on-surface">今日目标</div>
            <div className="text-xs text-on-surface-variant">
              完成{stats.goal?.target || 10}道练习题，正确率达到{stats.goal?.accuracy || 80}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {stats.goal?.current || 0}/{stats.goal?.target || 10}
            </div>
            <div className="text-xs text-on-surface-variant">题目</div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${stats.goal
                ? Math.min((stats.goal.current / stats.goal.target) * 100, 100)
                : 0}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 加载状态组件
 */
function ModeSelectLoading() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="animate-pulse space-y-6">
        <div className="bg-surface-container rounded-2xl p-6 h-32" />
        <div className="bg-surface-container rounded-2xl p-6 h-40" />
        <div className="bg-surface-container rounded-2xl p-6 h-40" />
      </div>
    </div>
  );
}

/**
 * ModeSelect - 练习模式选择页面（带Suspense包装）
 */
export default function ModeSelect() {
  return (
    <Suspense fallback={<ModeSelectLoading />}>
      <ModeSelectInner />
    </Suspense>
  );
}
