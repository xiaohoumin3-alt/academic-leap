'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import HomePage from '@/components/HomePage';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStart = () => {
    router.push('/practice');
  };

  const handleAssess = (retry = false) => {
    // 跳转到测评页面，retry=true表示重新测评
    router.push(retry ? '/assessment?mode=retry' : '/assessment');
  };

  const handleOpenConsole = () => {
    router.push('/console');
  };

  // 防止SSR hydration问题
  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  return (
    <HomePage
      onStart={handleStart}
      onAssess={handleAssess}
      onOpenConsole={handleOpenConsole}
    />
  );
}
