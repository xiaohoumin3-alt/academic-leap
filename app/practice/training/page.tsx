'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { TrainingMode } from '@/components/practice/TrainingMode';
import type { PracticeQuestion } from '@/hooks/usePracticeFlow';

interface StepResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  duration: number;
}

/**
 * 练习模式页面
 * 获取UOK推荐题目并渲染TrainingMode组件
 */
export default function TrainingPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 追踪答题结果用于最终保存
  const stepResultsRef = useRef<StepResult[]>([]);
  const practiceStartTimeRef = useRef<number>(Date.now());
  const totalCorrectRef = useRef<number>(0);

  // 从UOK推荐API获取题目
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const url = '/api/uok/recommend';
        console.log('Fetching from:', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 3 }), // 练习模式3题一组
          credentials: 'include', // 确保发送 cookies
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.status === 401) {
          // 未登录，跳转登录页
          router.push('/login');
          return;
        }

        const data = await response.json();

        // 检查题目不足错误（明确错误提示，拒绝降级）
        if (data.code === 'INSUFFICIENT_QUESTIONS') {
          // 显示详细错误信息，包括缺失难度和可用数量
          const missingDiff = data.missingDifficulty;
          const available = data.availableCounts || {};
          const availableList = Object.entries(available)
            .map(([k, v]) => `难度${k}: ${v}题`)
            .join(', ');

          setError(
            `当前缺少难度${missingDiff}的题目，无法进行练习。\n\n` +
            `可用题目分布：${availableList || '暂无'}\n\n` +
            `请联系管理员生成难度${missingDiff}的题目后再试。`
          );
          return;
        }

        // 检查是否有学习路径
        if (data.code === 'NO_LEARNING_PATH') {
          setError(data.message || '未找到活跃的学习路径，请先完成诊断测评（60-89分）');
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || '获取题目失败');
        }

        // 检查是否需要诊断
        if (data.needsDiagnostic && data.redirectTo) {
          setError(data.message || '建议先完成诊断测评以获得个性化推荐');
          return;
        }

        if (!data.questions || data.questions.length === 0) {
          throw new Error(data.error || '获取题目失败');
        }

        const mappedQuestions: PracticeQuestion[] = data.questions.map((q: any) => {
          // 解析content字段（可能是JSON字符串或已解析对象）
          const content = typeof q.content === 'string' ? JSON.parse(q.content) : q.content;

          return {
            id: q.id,
            type: q.type,
            question: content.question,
            answer: q.answer,
            options: q.options,
            explanation: q.explanation,
          };
        });

        setQuestions(mappedQuestions);

        // 重置练习追踪数据
        stepResultsRef.current = [];
        practiceStartTimeRef.current = Date.now();
        totalCorrectRef.current = 0;
      } catch (err) {
        console.error('Failed to fetch questions:', err);
        setError(err instanceof Error ? err.message : '获取题目失败');
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  // 处理完成回调 - 保存练习结果到数据库
  const handleComplete = async (results: { total: number; correct: number; xpEarned: number }) => {
    console.log('Practice completed:', results);

    const totalDuration = Date.now() - practiceStartTimeRef.current;

    // 调用 UOK finish API 保存练习记录
    try {
      const response = await fetch('/api/uok/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: stepResultsRef.current,
          totalQuestions: results.total,
          correctCount: results.correct,
          duration: totalDuration,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Practice saved:', data);
      } else {
        console.error('Failed to save practice:', await response.text());
      }
    } catch (err) {
      console.error('Failed to save practice:', err);
    }
  };

  // 处理反馈回调 - 同时追踪答题结果
  const handleFeedback = async (questionId: string, remembered: boolean) => {
    // 追踪答题结果
    const question = questions.find(q => q.id === questionId);
    const userAnswer = remembered
      ? (Array.isArray(question?.answer) ? question!.answer[0] : question?.answer || '')
      : '';
    const duration = Date.now() - practiceStartTimeRef.current;

    stepResultsRef.current.push({
      questionId,
      isCorrect: remembered,
      userAnswer,
      duration,
    });

    if (remembered) {
      totalCorrectRef.current += 1;
    }

    // 重置计时器为下一题准备
    practiceStartTimeRef.current = Date.now();

    try {
      const response = await fetch('/api/uok/answer', {
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
          masteryBefore: data.feedback?.masteryBefore ?? 0,
          masteryAfter: data.feedback?.masteryAfter ?? 0,
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
    // 根据错误类型决定操作按钮
    const isNoLearningPath = error.includes('学习路径');
    const primaryAction = isNoLearningPath
      ? { label: '去做诊断测评', path: '/assessment' }
      : { label: '返回首页', path: '/' };

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-on-surface">加载失败</h2>
          <p className="text-on-surface-variant">{error}</p>
          <button
            onClick={() => router.push(primaryAction.path)}
            className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
          >
            {primaryAction.label}
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
