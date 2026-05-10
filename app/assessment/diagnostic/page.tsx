'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DiagnosticMode } from '@/components/practice/DiagnosticMode';
import type { DiagnosticQuestion } from '@/hooks/useDiagnosticFlow';

/**
 * 诊断测评内容组件（需要 Suspense 因为使用 useSearchParams）
 */
function DiagnosticContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const attemptIdRef = useRef<string | null>(null);

  // 从 assessment/start API 获取诊断题目
  useEffect(() => {
    async function startAssessment() {
      try {
        // 从 URL 读取 retry 和 difficulty 参数
        const isRetry = searchParams.get('retry') === 'true';
        const difficultyParam = searchParams.get('difficulty');
        const requestedDifficulty = difficultyParam ? parseInt(difficultyParam, 10) : null;

        const requestBody: { retry: boolean; difficulty?: number } = { retry: isRetry };
        if (isRetry && requestedDifficulty !== null && !isNaN(requestedDifficulty)) {
          requestBody.difficulty = requestedDifficulty;
        }

        const response = await fetch('/api/assessment/start', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          router.push('/login');
          return;
        }

        // 首先检查是否需要选择教材
        if (data.requireTextbookSelection) {
          router.push('/me');
          return;
        }

        // 检查是否已完成初始测评
        if (data.data?.alreadyCompleted) {
          setError('您已完成初始测评（得分：' + (data.data?.score ?? 0) + '分）。如需重新诊断，请点击下方按钮。');
          setShowRetry(true);
          setIsLoading(false);
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(data?.error || '获取题目失败');
        }

        // 保存 attemptId 用于后续提交
        if (data.data?.attemptId) {
          attemptIdRef.current = data.data.attemptId;
        }

        // 映射题目格式
        const mappedQuestions: DiagnosticQuestion[] = (data.data?.questions || []).map((q: any) => {
          let questionText = '';
          let options: string[] | undefined;
          let explanation: string | undefined;

          if (typeof q.content === 'string') {
            try {
              const parsed = JSON.parse(q.content);
              questionText = parsed.question || q.content;
              options = parsed.options;
              explanation = parsed.explanation;
            } catch {
              questionText = q.content;
            }
          } else if (q.content && typeof q.content === 'object') {
            questionText = q.content.question || '';
            options = q.content.options;
            explanation = q.content.explanation;
          }

          return {
            id: q.id,
            type: q.type,
            question: questionText,
            answer: q.answer,
            options: options,
            explanation: explanation,
          };
        });

        setQuestions(mappedQuestions);
      } catch (err) {
        console.error('Failed to start assessment:', err);
        setError(err instanceof Error ? err.message : '获取题目失败');
      } finally {
        setIsLoading(false);
      }
    }

    startAssessment();
  }, [router, searchParams]);

  // 处理重新测评
  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    setShowRetry(false);

    try {
      // 从 URL 读取 difficulty 参数
      const difficultyParam = searchParams.get('difficulty');
      const requestedDifficulty = difficultyParam ? parseInt(difficultyParam, 10) : null;

      const requestBody: { retry: boolean; difficulty?: number } = { retry: true };
      if (requestedDifficulty !== null && !isNaN(requestedDifficulty)) {
        requestBody.difficulty = requestedDifficulty;
      }

      const response = await fetch('/api/assessment/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data.success) {
        throw new Error(data?.error || '获取题目失败');
      }

      if (data.data?.attemptId) {
        attemptIdRef.current = data.data.attemptId;
      }

      const mappedQuestions: DiagnosticQuestion[] = (data.data?.questions || []).map((q: any) => {
        let questionText = '';
        let options: string[] | undefined;
        let explanation: string | undefined;

        if (typeof q.content === 'string') {
          try {
            const parsed = JSON.parse(q.content);
            questionText = parsed.question || q.content;
            options = parsed.options;
            explanation = parsed.explanation;
          } catch {
            questionText = q.content;
          }
        } else if (q.content && typeof q.content === 'object') {
          questionText = q.content.question || '';
          options = q.content.options;
          explanation = q.content.explanation;
        }

        return {
          id: q.id,
          type: q.type,
          question: questionText,
          answer: q.answer,
          options: options,
          explanation: explanation,
        };
      });

      setQuestions(mappedQuestions);
    } catch (err) {
      console.error('Failed to start assessment:', err);
      setError(err instanceof Error ? err.message : '获取题目失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (result: { accuracy: number; adaptiveAction: any; score: number; answers: (string | null)[]; correctCount?: number }) => {
    console.log('Diagnostic completed:', result, 'attemptId:', attemptIdRef.current);

    if (attemptIdRef.current) {
      const answersParam = encodeURIComponent(JSON.stringify(result.answers));
      const questionIdsParam = encodeURIComponent(JSON.stringify(questions.map(q => q.id)));

      router.push(
        `/assessment/result?attemptId=${attemptIdRef.current}` +
        `&difficulty=${result.adaptiveAction?.nextDifficulty || 6}` +
        `&answers=${answersParam}` +
        `&questionIds=${questionIdsParam}` +
        `&accuracy=${result.accuracy}`
      );
    } else {
      router.push('/');
    }
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
          <div className="text-4xl">{showRetry ? '📋' : '⚠️'}</div>
          <h2 className="text-xl font-bold text-on-surface">{showRetry ? '初始测评已完成' : '加载失败'}</h2>
          <p className="text-on-surface-variant">{error}</p>
          {showRetry ? (
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors w-full"
              >
                重新诊断测评
              </button>
              <button
                onClick={() => router.push('/assessment/result')}
                className="px-6 py-3 border border-secondary text-secondary rounded-full hover:bg-secondary/10 transition-colors w-full"
              >
                查看测评结果
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors"
            >
              返回首页
            </button>
          )}
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
            当前没有可用的诊断题目，请先在教材管理中添加知识点并开启诊断测评功能
          </p>
          <button
            onClick={() => router.push('/me')}
            className="px-6 py-3 bg-secondary text-white rounded-full hover:bg-secondary/90 transition-colors"
          >
            去配置教材
          </button>
        </div>
      </div>
    );
  }

  return (
    <DiagnosticMode
      questions={questions}
      attemptId={attemptIdRef.current || ''}
      onComplete={handleComplete}
    />
  );
}

/**
 * 诊断测评页面
 * 使用 Suspense wrapper 因为 useSearchParams 需要动态渲染
 */
export default function DiagnosticPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-on-surface-variant">正在加载...</p>
        </div>
      </div>
    }>
      <DiagnosticContent />
    </Suspense>
  );
}
