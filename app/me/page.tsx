'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '../../components/MaterialIcon';
import { BottomNavigation } from '../../components/BottomNavigation';
import LearningSettings from '@/components/LearningSettings';

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
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
                <span>
                  {settings.grade}年级 · {settings.selectedSubject || '未设置'}
                  {settings.selectedTextbookId && ' | 目标 ' + (settings.targetScore || DEFAULT_TARGET_SCORE) + '分'}
                </span>
              </div>
            </div>
          ) : (
            <button
              className="w-full py-3 rounded-xl bg-primary text-on-primary font-medium"
            >
              设置学习信息
            </button>
          )}

          {/* 学习设置（始终展开） */}
          <div className="mt-4 -mx-2 -mb-2">
            <LearningSettings onRefresh={refreshSettings} embedded={true} />
          </div>
        </div>

        {/* 设置入口 */}
        <button
          onClick={() => router.push('/console')}
          className="w-full py-4 text-on-surface font-medium hover:bg-surface-container-high rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="settings" style={{ fontSize: '20px' }} />
          设置
        </button>

        {/* 退出登录 */}
        <button
          onClick={() => {
            fetch('/api/auth/signout', { method: 'POST' }).then(() => {
              router.push('/login');
              router.refresh();
            });
          }}
          className="w-full mt-3 py-4 text-error font-medium hover:bg-error-container/10 rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="logout" style={{ fontSize: '20px' }} />
          退出登录
        </button>
      </div>

      <BottomNavigation />
    </div>
  );
}
