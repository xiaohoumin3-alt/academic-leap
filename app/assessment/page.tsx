'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ExercisePage from '@/components/ExercisePage';

function AssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [difficulty, setDifficulty] = useState(3);

  const isRetry = searchParams.get('mode') === 'retry';

  // 根据是否重新测评设置难度
  useEffect(() => {
    if (isRetry) {
      // 重新测评使用更高难度
      setDifficulty(7);
    } else {
      setDifficulty(3);
    }
  }, [isRetry]);

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
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <AssessmentContent />
    </Suspense>
  );
}
