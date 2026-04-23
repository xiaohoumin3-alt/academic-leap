'use client';

import { useState, useEffect, useRef } from 'react';
import { analyticsApi } from '@/lib/api';

export interface UserStatus {
  isNewUser: boolean;
  hasCompletedAssessment: boolean;
  isLoading: boolean;
}

// 使用 ref 存储缓存状态，避免模块级变量在 webpack 热重载时的问题
const cache = new Map<string, { data: UserStatus; timestamp: number }>();
const CACHE_DURATION = 60000; // 1分钟缓存
const CACHE_KEY = 'userStatus';

export function useUserStatus(): UserStatus {
  const [status, setStatus] = useState<UserStatus>({
    isNewUser: true,
    hasCompletedAssessment: false,
    isLoading: true,
  });
  const hasInitialized = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const now = Date.now();

    // 检查缓存
    const cached = cache.get(CACHE_KEY);
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      setStatus(cached.data);
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await analyticsApi.getOverview();
        if (res.success && res.data) {
          const hasCompleted = res.data.overview.totalAttempts > 0;
          const newStatus: UserStatus = {
            isNewUser: !hasCompleted,
            hasCompletedAssessment: hasCompleted,
            isLoading: false,
          };

          // 更新缓存
          cache.set(CACHE_KEY, { data: newStatus, timestamp: now });

          setStatus(newStatus);
        }
      } catch {
        // API失败时默认为新用户
        setStatus({
          isNewUser: true,
          hasCompletedAssessment: false,
          isLoading: false,
        });
      }
    };

    fetchStatus();
  }, []);

  return status;
}

// 刷新缓存（测评完成后调用）
export function invalidateUserStatusCache() {
  cache.delete(CACHE_KEY);
}
