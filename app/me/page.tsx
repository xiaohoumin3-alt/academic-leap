'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../../components/MaterialIcon';
import { BottomNavigation } from '../../components/BottomNavigation';
import LearningPathOverview from '@/components/LearningPathOverview';
import WeeklyReportDialog from '@/components/WeeklyReportDialog';
import LearningSettingsDialog from '@/components/LearningSettingsDialog';

const DEFAULT_TARGET_SCORE = 90;

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserSettings {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  targetScore?: number;
}

export default function MePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // 获取用户信息和学习设置
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/user/settings').then(res => res.json()).catch(() => ({ data: null }))
    ])
      .then(([sessionData, settingsData]) => {
        if (sessionData && sessionData.user) {
          setUser(sessionData.user);
          if (settingsData.data) {
            setSettings(settingsData.data);
          }
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        // Silently handle error, show empty state
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshSettings = async () => {
    try {
      const settingsRes = await fetch('/api/user/settings');
      if (!settingsRes.ok) {
        throw new Error('获取设置失败');
      }
      const settingsData = await settingsRes.json();
      if (settingsData.data) {
        setSettings(settingsData.data);
        setSettingsError(null);
      }
    } catch {
      setSettingsError('获取设置失败，请重试');
    }
  };

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
        {/* 用户信息 & 设置卡片 */}
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

          {settingsError && (
            <div className="bg-error-container/10 text-error text-sm p-3 rounded-xl mb-4">
              {settingsError}
            </div>
          )}

          {settings ? (
            <div className="bg-surface rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
                  <span>
                    {settings.grade}年级 · {settings.selectedSubject || '未设置'}
                    {settings.selectedTextbookId && ' | 目标 ' + (settings.targetScore || DEFAULT_TARGET_SCORE) + '分'}
                  </span>
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  修改
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSettings(true)}
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-medium"
            >
              设置学习信息
            </button>
          )}
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

      {/* 学习设置弹窗 */}
      <LearningSettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={async () => {
          await refreshSettings();
        }}
        settings={settings}
      />
    </div>
  );
}
