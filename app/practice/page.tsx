'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import ExercisePage from '@/components/ExercisePage';
import { practiceApi } from '@/lib/api';

function PracticePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'diagnostic' ? 'diagnostic' : 'training';
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const handleBack = () => {
    router.push('/');
  };

  const handleStart = async (questionId: string) => {
    try {
      const res = await practiceApi.start({ mode, questionId });
      if (res.data?.attemptId) {
        setAttemptId(res.data.attemptId);
      }
    } catch (error) {
      console.error('开始练习失败:', error);
    }
  };

  const handleFinish = async (results: { score: number; duration: number; steps: any[] }) => {
    try {
      if (attemptId) {
        await practiceApi.finish({
          attemptId,
          score: results.score,
          duration: results.duration,
        });
      }
    } catch (error) {
      console.error('保存练习结果失败:', error);
    } finally {
      // 测评模式跳转到分析页面，训练模式返回首页
      router.push(mode === 'diagnostic' ? '/analyze' : '/');
    }
  };

  return (
    <ExercisePage
      mode={mode}
      initialDifficulty={2}
      onBack={handleBack}
      onStart={handleStart}
      onFinish={handleFinish}
    />
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
      <PracticePageContent />
    </Suspense>
  );
}
