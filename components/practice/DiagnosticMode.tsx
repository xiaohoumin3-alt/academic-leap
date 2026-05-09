'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardCheck, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './ProgressIndicator';
import { QuestionRenderer, type QuestionData } from './QuestionRenderer';
import { DiagnosticResult } from './DiagnosticResult';
import { useDiagnosticFlow, type DiagnosticQuestion, getDiagnosticDecision } from '@/hooks/useDiagnosticFlow';

interface DiagnosticModeProps {
  questions: DiagnosticQuestion[];
  attemptId: string;
  onComplete?: (result: { accuracy: number; adaptiveAction: any; score: number; answers: (string | null)[] }) => void;
  initialDifficulty?: number;
  onDifficultyChange?: (difficulty: number) => void;
}

export function DiagnosticMode({ questions, attemptId, onComplete, initialDifficulty = 6, onDifficultyChange }: DiagnosticModeProps) {
  const router = useRouter();
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [currentQuestions, setCurrentQuestions] = useState(questions);
  const [isLoadingNew, setIsLoadingNew] = useState(false);

  // 难度变化回调
  const handleDifficultyChange = useCallback((newDifficulty: number) => {
    setCurrentDifficulty(newDifficulty);
    onDifficultyChange?.(newDifficulty);
  }, [onDifficultyChange]);

  // 处理重新测评 - 真正调用 API 获取新难度题目
  const handleRetryWithNewDifficulty = useCallback(async (nextDifficulty: number) => {
    setIsLoadingNew(true);

    try {
      const response = await fetch('/api/assessment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retry: true,
          difficulty: nextDifficulty,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.questions) {
        // 映射题目格式
        const newQuestions: DiagnosticQuestion[] = data.data.questions.map((q: any) => {
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
            options,
            explanation,
          };
        });

        // 更新题目
        setCurrentQuestions(newQuestions);
        setCurrentDifficulty(nextDifficulty);
        onDifficultyChange?.(nextDifficulty);

        // 重置答题状态
        flow.handleRestart();
      } else {
        console.error('获取新难度题目失败:', data.error);
        setError('获取新难度题目失败，请重试');
      }
    } catch (err) {
      console.error('Failed to load new difficulty questions:', err);
      setError('加载失败，请重试');
    } finally {
      setIsLoadingNew(false);
    }
  }, [onDifficultyChange]);

  // 处理进入练习
  const handleEnterPractice = useCallback(() => {
    router.push(`/practice?difficulty=${currentDifficulty}`);
  }, [router, currentDifficulty]);

  // 错误状态
  const [error, setError] = useState<string | null>(null);

  const flow = useDiagnosticFlow(
    currentQuestions,
    async (result) => {
      // 调用后端 API 获取完整结果
      try {
        const response = await fetch('/api/assessment/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attemptId,
            answers: result.answers,
            questionIds: currentQuestions.map(q => q.id),
            currentDifficulty,
          }),
        });

        const data = await response.json();
        if (data.success && data.data) {
          onComplete?.({
            accuracy: data.data.accuracy,
            adaptiveAction: data.data.adaptiveAction,
            score: data.data.score,
            answers: result.answers || [],
          });
        } else {
          console.error('获取测评结果失败:', data.error);
          setError(data.error || '获取结果失败');
        }
      } catch (err) {
        console.error('Failed to submit:', err);
        setError('提交失败，请重试');
      }
    },
    { currentDifficulty, onDifficultyChange: handleDifficultyChange }
  );

  // 监听结果变化，自动计算自适应决策（用于 DiagnosticResult）
  useEffect(() => {
    if (flow.result && !flow.adaptiveAction) {
      flow.handleDiagnosticComplete(flow.result);
    }
  }, [flow.result, flow.adaptiveAction, flow]);

  // 处理提交
  const handleSubmit = async () => {
    await flow.handleSubmit();
  };

  const handleGoBack = () => {
    router.push('/');
  };

  // 加载新题目状态
  if (isLoadingNew) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
        <div className="text-center space-y-4 py-12">
          <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mx-auto animate-pulse">
            <ClipboardCheck className="w-8 h-8 text-secondary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-on-surface">正在加载新难度题目...</h2>
            <p className="text-on-surface-variant">难度 {currentDifficulty} 级</p>
          </div>
        </div>
      </div>
    );
  }

  // 渲染答题状态
  const renderAnsweringState = () => {
    const question = flow.currentQuestion;
    if (!question) return null;

    const questionData: QuestionData = {
      id: question.id,
      type: question.type,
      question: question.question,
      answer: question.answer,
      options: question.options,
      explanation: question.explanation,
    };

    const userAnswer = flow.answers[flow.currentIndex] || '';

    return (
      <div className="space-y-6">
        {/* 题目内容 */}
        <div className={cn(
          'p-6 rounded-2xl bg-surface-container',
          'border border-outline/20'
        )}>
          <div className="flex items-center gap-2 mb-4">
            <span className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              'bg-secondary-container text-on-secondary-container'
            )}>
              第 {flow.currentIndex + 1} 题
            </span>
          </div>
          <QuestionRenderer
            question={questionData}
            userAnswer={userAnswer}
            onAnswerChange={flow.handleAnswer}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-center gap-4">
          {!flow.isLastQuestion ? (
            <button
              onClick={flow.handleNext}
              disabled={!flow.hasAnswered}
              className={cn(
                'px-8 py-3 rounded-full font-semibold',
                'bg-primary text-white',
                'hover:bg-primary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg shadow-primary/30'
              )}
            >
              下一题
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!flow.hasAnswered}
              className={cn(
                'px-8 py-3 rounded-full font-semibold',
                'bg-secondary text-white',
                'hover:bg-secondary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-lg shadow-secondary/30'
              )}
            >
              提交全部答案
            </button>
          )}
        </div>
      </div>
    );
  };

  // 渲染提交中状态
  const renderSubmittingState = () => {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mx-auto animate-pulse">
          <ClipboardCheck className="w-8 h-8 text-secondary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">正在计算结果...</h2>
          <p className="text-on-surface-variant">请稍候</p>
        </div>
      </div>
    );
  };

  // 渲染结果状态
  const renderResultState = () => {
    if (!flow.result) return null;

    // 使用 hook 中的自适应动作或计算决策
    const adaptiveAction = flow.adaptiveAction || getDiagnosticDecision(currentDifficulty, flow.result.accuracy);

    return (
      <DiagnosticResult
        result={flow.result}
        onRestart={flow.handleRestart}
        onViewAnalysis={() => router.push('/analyze')}
        currentDifficulty={currentDifficulty}
        adaptiveAction={adaptiveAction}
        onRetryDiagnostic={handleRetryWithNewDifficulty}
        onEnterPractice={handleEnterPractice}
      />
    );
  };

  // 渲染错误状态
  const renderErrorState = () => {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto">
          <X className="w-8 h-8 text-error" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface mb-2">出了点问题</h2>
          <p className="text-on-surface-variant">{error || flow.error?.message || '请重试'}</p>
        </div>
        <button
          onClick={flow.retry}
          className={cn(
            'px-8 py-3 rounded-full font-semibold',
            'bg-primary text-white',
            'hover:bg-primary/90 transition-colors'
          )}
        >
          重试
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={handleGoBack}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>返回</span>
      </button>

      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-on-surface">诊断测评</h1>
          <p className="text-xs text-on-surface-variant">摸底考试，完成后查看分析结果</p>
        </div>
      </div>

      {/* 进度指示器（点状） */}
      {flow.state === 'answering' && (
        <div className="flex gap-1">
          {flow.answers.map((answer, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-2 rounded-full transition-all duration-300',
                answer !== null && 'bg-secondary',
                answer === null && i === flow.currentIndex && 'bg-secondary/50 animate-pulse',
                answer === null && i !== flow.currentIndex && 'bg-surface-container-highest'
              )}
            />
          ))}
        </div>
      )}

      {/* 状态渲染 */}
      {flow.state === 'answering' && renderAnsweringState()}
      {flow.state === 'submitting' && renderSubmittingState()}
      {flow.state === 'result' && renderResultState()}
      {flow.state === 'error' && renderErrorState()}
    </div>
  );
}
