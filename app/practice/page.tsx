'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 练习页面 - 自动重定向到练习模式
 * 保留此路由以兼容现有链接
 */
export default function PracticePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/practice/training');
  }, [router]);

  // 加载状态
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-on-surface-variant">正在进入练习模式...</p>
      </div>
    </div>
  );
}
