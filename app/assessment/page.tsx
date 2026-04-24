'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ExercisePage from '@/components/ExercisePage';

function AssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [difficulty, setDifficulty] = useState(3);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const isRetry = searchParams.get('mode') === 'retry';

  // 检查用户是否已设置教材
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const overviewRes = await fetch('/api/analytics/overview');
        const data = await overviewRes.json();
        const overview = data.data?.overview || data.overview;

        // 如果没有选择教材，跳转到首页（会触发 onboarding）
        if (!overview?.selectedTextbookId) {
          setNeedsSetup(true);
        } else {
          setNeedsSetup(false);
        }
      } catch (e) {
        console.error('检查设置失败:', e);
        setNeedsSetup(true);
      } finally {
        setLoading(false);
      }
    };

    checkSetup();
  }, []);

  // 根据是否重新测评设置难度
  useEffect(() => {
    if (isRetry) {
      setDifficulty(7);
    } else {
      setDifficulty(3);
    }
  }, [isRetry]);

  // 如果需要设置，显示提示
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-medium text-on-surface-variant">检查设置中...</p>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-4xl">📚</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-on-surface mb-2">需要先设置教材</h2>
          <p className="text-on-surface-variant">请先选择你的年级和教材，才能开始测评</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium"
        >
          去设置
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 text-on-surface-variant"
        >
          返回
        </button>
      </div>
    );
  }

  const handleFinish = (result: any) => {
    // 测评模式：跳转到结果页，传递 attemptId 用于获取完整分析
    if (result.attemptId) {
      router.push(`/assessment/result?attemptId=${result.attemptId}&retry=${isRetry}&difficulty=${difficulty}`);
    } else {
      // 降级：携带结果数据（如果有）
      const resultData = encodeURIComponent(JSON.stringify(result));
      router.push(`/assessment/result?data=${resultData}&retry=${isRetry}&difficulty=${difficulty}`);
    }
  };

  return (
    <ExercisePage
      mode="diagnostic"
      initialDifficulty={difficulty}
      diagnosticConfig={{
        questionCount: 10,
        autoAdjustDifficulty: false,
      }}
      onFinish={handleFinish}
      onBack={() => router.push('/')}
    />
  );
}

export default function Assessment() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <AssessmentContent />
    </Suspense>
  );
}
