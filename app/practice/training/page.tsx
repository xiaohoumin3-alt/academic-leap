'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrainingMode } from '@/components/practice/TrainingMode';
import type { PracticeQuestion } from '@/hooks/usePracticeFlow';

/**
 * 练习模式页面
 * 获取UOK推荐题目并渲染TrainingMode组件
 */
export default function TrainingPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从UOK推荐API获取题目
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const response = await fetch('/api/uok/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 3 }), // 练习模式3题一组
        });

        if (!response.ok) {
          throw new Error('获取题目失败');
        }

        const data = await response.json();
        const mappedQuestions: PracticeQuestion[] = data.questions.map((q: any) => ({
          id: q.id,
          type: q.type,
          question: typeof q.content === 'string' ? q.content : q.content.question,
          answer: q.answer,
          options: q.options,
          explanation: q.explanation,
        }));

        setQuestions(mappedQuestions);
      } catch (err) {
        console.error('Failed to fetch questions:', err);
        setError(err instanceof Error ? err.message : '获取题目失败');
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  // 处理完成回调
  const handleComplete = (results: { total: number; correct: number; xpEarned: number }) => {
    console.log('Practice completed:', results);
    // 可以在这里添加完成后的逻辑，如更新用户统计数据
  };

  // 处理反馈回调
  const handleFeedback = async (questionId: string, remembered: boolean) => {
    try {
      const response = await fetch('/api/uok/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          isCorrect: remembered,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          masteryBefore: data.masteryBefore ?? 0,
          masteryAfter: data.masteryAfter ?? 0,
        };
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
    return null;
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-on-surface-variant">正在加载练习题目...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-on-surface">加载失败</h2>
          <p className="text-on-surface-variant">{error}</p>
          <button
            onClick={() => router.push('/practice')}
            className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
          >
            返回练习页面
          </button>
        </div>
      </div>
    );
  }

  // 无题目状态
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="text-4xl">📚</div>
          <h2 className="text-xl font-bold text-on-surface">暂无练习题目</h2>
          <p className="text-on-surface-variant">
            当前没有可用的练习题目，请先选择知识点或完成诊断测评
          </p>
          <button
            onClick={() => router.push('/practice')}
            className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
          >
            返回练习页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <TrainingMode
      questions={questions}
      onComplete={handleComplete}
      onFeedback={handleFeedback}
    />
  );
}
