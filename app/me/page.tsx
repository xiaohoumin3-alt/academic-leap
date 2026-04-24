'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../../components/MaterialIcon';
import { BottomNavigation } from '../../components/BottomNavigation';
import LearningSettings from '@/components/LearningSettings';
import LearningPathOverview from '@/components/LearningPathOverview';
import WeeklyReportDialog from '@/components/WeeklyReportDialog';

interface UserStats {
  currentScore: number;
  targetScore: number;
  totalAttempts: number;
  avgScore: number;
  totalQuestions: number;
  correctRate: number;
  recentAttempts: Array<{
    id: string;
    mode: string;
    score: number;
    duration: number;
    completedAt: string | null;
  }>;
  weakKnowledge: Array<{
    knowledgePoint: string;
    mastery: number;
  }>;
  streak: number;
}

interface AnalyticsData {
  overview: {
    totalAttempts: number;
    completedAttempts: number;
    averageScore: number;
    lowestScore: number;
    totalMinutes: number;
    completionRate: number;
    dataReliability: "high" | "medium" | "low";
    volatilityRange: number;
    initialAssessmentCompleted: boolean;
    initialAssessmentScore: number;
    totalQuestions: number;
    correctRate: number;
  };
  dailyData: Array<{ date: string; count: number; avgScore: number }>;
  topKnowledge: Array<{ knowledgePoint: string; mastery: number }>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserSettings {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
}

export default function MePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // 获取用户信息和统计数据 - 使用 analytics API 保持数据一致性
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/analytics/overview').then(res => res.json()).catch(() => ({ overview: null })),
      fetch('/api/user/settings').then(res => res.json()).catch(() => ({ data: null }))
    ])
      .then(([sessionData, analyticsData, settingsData]) => {
        if (sessionData && sessionData.user) {
          setUser(sessionData.user);
          if (settingsData.data) {
            setSettings(settingsData.data);
          }
          // 将 analytics 数据转换为 stats 格式
          if (analyticsData.overview) {
            setStats({
              currentScore: analyticsData.overview.averageScore,
              targetScore: 90,
              totalAttempts: analyticsData.overview.totalAttempts,
              avgScore: analyticsData.overview.averageScore,
              totalQuestions: analyticsData.overview.totalQuestions ?? 0,
              correctRate: analyticsData.overview.correctRate ?? 0,
              recentAttempts: [],
              weakKnowledge: [],
              streak: 0,
            });
          }
        } else {
          setUser(null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalQuestions = stats?.totalQuestions ?? 0;
  const accuracy = stats?.correctRate ?? 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  // 未登录 - 显示登录引导
  if (!user) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 px-6 py-12 flex flex-col items-center justify-center">
          <div className="text-center mb-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <MaterialIcon icon="person" className="text-primary" style={{ fontSize: '48px' }} />
            </div>
            <h1 className="text-3xl font-display font-black text-on-surface mb-3">
              登录体验更多功能
            </h1>
            <p className="text-on-surface-variant text-lg">
              登录后可保存学习进度、查看详细分析
            </p>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-full py-5 px-6 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              <MaterialIcon icon="login" className="fill-on-primary" style={{ fontSize: '24px' }} />
              <span className="font-display font-bold text-lg">立即登录</span>
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full bg-surface-container-low text-on-surface rounded-full py-4 px-6 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <MaterialIcon icon="home" style={{ fontSize: '20px' }} />
              <span className="font-medium">返回首页</span>
            </button>
          </div>
        </div>

        <BottomNavigation />
      </div>
    );
  }

  // 已登录 - 显示用户信息
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-6 py-8">
        {/* 用户信息卡片 */}
        <div className="bg-surface-container-low rounded-[2rem] p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="person" className="text-primary" style={{ fontSize: '32px' }} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-display font-bold text-on-surface">
                {user.name || '学习者'}
              </h2>
              <p className="text-sm text-on-surface-variant">{user.email}</p>
            </div>
          </div>

          {settings && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
              <span>{settings.grade}年级 · {settings.selectedSubject || '未设置'}</span>
            </div>
          )}
        </div>

        {/* 学习统计 */}
        <div className="bg-surface-container-low rounded-[2rem] p-6 mb-6">
          <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
            <MaterialIcon icon="bar_chart" className="text-primary" style={{ fontSize: '20px' }} />
            学习统计
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-display font-black text-primary">
                {stats?.totalAttempts || 0}
              </p>
              <p className="text-xs text-on-surface-variant">练习次数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-black text-secondary">
                {totalQuestions}
              </p>
              <p className="text-xs text-on-surface-variant">答题数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-black text-tertiary">
                {accuracy}%
              </p>
              <p className="text-xs text-on-surface-variant">正确率</p>
            </div>
          </div>
        </div>

        {/* 学习路径概览 */}
        <div className="mb-6">
          <LearningPathOverview
            onShowWeeklyReport={() => setShowWeeklyReport(true)}
          />
        </div>

        {/* 功能列表 */}
        <div className="space-y-3">
          <button onClick={() => router.push('/me/history')} className="w-full flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="history" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <span className="flex-1 text-left font-medium text-on-surface">练习记录</span>
            <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>

          <button onClick={() => router.push('/me/mistakes')} className="w-full flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
              <MaterialIcon icon="bookmark" className="text-on-secondary-container" style={{ fontSize: '22px' }} />
            </div>
            <span className="flex-1 text-left font-medium text-on-surface">错题本</span>
            <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>

          <button onClick={() => router.push('/console')} className="w-full flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-colors">
            <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center">
              <MaterialIcon icon="settings" className="text-on-tertiary-container" style={{ fontSize: '22px' }} />
            </div>
            <span className="flex-1 text-left font-medium text-on-surface">设置</span>
            <MaterialIcon icon="chevron_right" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        </div>

        {/* 学习设置 */}
        <div className="mt-6">
          <LearningSettings onRefresh={async () => {
            // 刷新学习设置
            const settingsRes = await fetch('/api/user/settings');
            const settingsData = await settingsRes.json();
            if (settingsData.data) {
              setSettings(settingsData.data);
            }
          }} />
        </div>

        {/* 退出登录 */}
        <button
          onClick={() => {
            fetch('/api/auth/signout', { method: 'POST' }).then(() => {
              router.push('/login');
              router.refresh();
            });
          }}
          className="w-full mt-6 py-4 text-error font-medium hover:bg-error-container/10 rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="logout" style={{ fontSize: '20px' }} />
          退出登录
        </button>
      </div>

      <BottomNavigation />

      {/* 周报弹窗 */}
      <WeeklyReportDialog
        isOpen={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
        onConfirmRecalibrate={() => {
          // 重组后刷新页面
          router.refresh();
        }}
      />
    </div>
  );
}
