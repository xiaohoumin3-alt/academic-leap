'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import MaterialIcon from '../components/MaterialIcon';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('应用错误:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-error-container/20 flex items-center justify-center mx-auto mb-6">
          <MaterialIcon icon="error" className="text-error" style={{ fontSize: '32px' }} />
        </div>

        <h1 className="text-2xl font-display font-black text-on-surface text-center mb-4">
          哎呀，出了点问题
        </h1>

        <p className="text-on-surface-variant text-center mb-8">
          应用遇到了意外错误。请尝试刷新页面或返回首页。
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full py-4 rounded-full bg-primary text-on-primary font-display font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <MaterialIcon icon="refresh" className="" style={{ fontSize: '20px' }} />
            重试
          </button>

          <Link
            href="/"
            className="w-full py-4 rounded-full bg-surface-container-highest text-on-surface font-display font-bold text-lg flex items-center justify-center gap-2 hover:bg-surface-container-highest/80 active:scale-95 transition-all"
          >
            <MaterialIcon icon="home" className="" style={{ fontSize: '20px' }} />
            返回首页
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 p-4 bg-surface rounded-2xl">
            <summary className="text-xs font-bold text-on-surface-variant cursor-pointer">
              错误详情 (开发模式)
            </summary>
            <pre className="mt-2 text-[10px] text-on-surface-variant overflow-auto max-h-32">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
