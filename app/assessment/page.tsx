'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 测评页面 - 自动重定向到诊断测评
 * 保留此路由以兼容现有链接
 */
export default function AssessmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/assessment/diagnostic');
  }, [router]);

  // 加载状态
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 rounded-full border-4 border-secondary border-t-transparent animate-spin mx-auto" />
        <p className="text-on-surface-variant">正在进入测评模式...</p>
      </div>
    </div>
  );
}
