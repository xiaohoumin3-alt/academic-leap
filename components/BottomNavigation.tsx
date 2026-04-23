'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import MaterialIcon from './MaterialIcon';
import { useUserStatus } from '@/lib/hooks/useUserStatus';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  requiresAssessment: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '首页', icon: 'home', requiresAssessment: false },
  { path: '/practice', label: '练习', icon: 'my_location', requiresAssessment: true },
  { path: '/analyze', label: '分析', icon: 'bar_chart', requiresAssessment: true },
  { path: '/me', label: '我的', icon: 'person', requiresAssessment: false },
];

export const BottomNavigation: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { hasCompletedAssessment, isLoading } = useUserStatus();

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  const handleClick = (item: NavItem) => {
    // 需要完成测评但用户未完成
    if (item.requiresAssessment && !hasCompletedAssessment && !isLoading) {
      alert('请先完成初始测评');
      return;
    }
    router.push(item.path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-highest border-t border-surface-variant/20 px-6 py-3 flex justify-around items-center">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path);
        const disabled = item.requiresAssessment && !hasCompletedAssessment && !isLoading;

        return (
          <button
            key={item.path}
            onClick={() => handleClick(item)}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-opacity ${
              disabled ? 'opacity-40 cursor-not-allowed' : ''
            }`}
            disabled={disabled}
          >
            <MaterialIcon
              icon={item.icon}
              className={active ? 'text-primary' : 'text-on-surface-variant'}
              style={{ fontSize: '20px' }}
            />
            <span
              className={`text-xs font-medium ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
