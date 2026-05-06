'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DiagnosticMode } from '@/components/practice/DiagnosticMode';
import type { DiagnosticQuestion } from '@/hooks/useDiagnosticFlow';

/**
 * 诊断测评页面
 * 获取固定难度题目并渲染DiagnosticMode组件
 */
export default function DiagnosticPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从UOK推荐API获取诊断题目（固定难度）
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const response = await fetch('/api/uok/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count: 10, // 诊断模式10题
            mode: 'diagnostic', // 诊断模式标识
          }),
        });

        if (!response.ok) {
          throw new Error('获取题目失败');
        }

        const data = await response.json();
        const mappedQuestions: DiagnosticQuestion[] = data.questions.map((q: any) => ({
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
  const handleComplete = (result: { accuracy: number; correctCount: number; wrongCount: number }) => {
    console.log('Diagnostic completed:', result);
    // 可以在这里添加完成后的逻辑，如保存诊断结果
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-on-surface-variant">正在加载诊断题目...</p>
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
            onClick={() => router.push('/assessment')}
            className="px-6 py-3 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors"
          >
            返回测评页面
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
          <div className="text-4xl">📋</div>
          <h2 className="text-xl font-bold text-on-surface">暂无诊断题目</h2>
          <p className="text-on-surface-variant">
            当前没有可用的诊断题目，请稍后再试
          </p>
          <button
            onClick={() => router.push('/assessment')}
            className="px-6 py-3 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors"
          >
            返回测评页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <DiagnosticMode
      questions={questions}
      onComplete={handleComplete}
    />
  );
}
