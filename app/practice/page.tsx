'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import ExercisePage from '@/components/ExercisePage';
import { practiceApi } from '@/lib/api';
import type { ExerciseResult } from '@/components/ExercisePage';
import { BottomNavigation } from '@/components/BottomNavigation';

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

  const handleFinish = async (results: ExerciseResult) => {
    console.log('练习完成:', results);

    // 显示独立性评估结果
    if (results.independenceResult) {
      const { independenceLabel, independenceEmoji, finalScore, breakdown } = results.independenceResult;
      console.log(`${independenceEmoji} ${independenceLabel} - 得分: ${finalScore}`);
      console.log('得分明细:', breakdown);
    }

    // 仅测评模式跳转到分析页面，训练模式不跳转让用户选择
    if (mode === 'diagnostic') {
      router.push('/analyze');
    }
  };

  return (
    <>
      <ExercisePage
        mode={mode}
        initialDifficulty={2}
        onBack={handleBack}
        onStart={handleStart}
        onFinish={handleFinish}
      />
      <BottomNavigation />
    </>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
      <PracticePageContent />
    </Suspense>
  );
}
