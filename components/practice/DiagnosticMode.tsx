'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardCheck, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './ProgressIndicator';
import { QuestionRenderer, type QuestionData } from './QuestionRenderer';
import { DiagnosticResult } from './DiagnosticResult';
import { useDiagnosticFlow, type DiagnosticQuestion } from '@/hooks/useDiagnosticFlow';

interface DiagnosticModeProps {
  questions: DiagnosticQuestion[];
  onComplete?: (result: { accuracy: number; correctCount: number; wrongCount: number }) => void;
}

export function DiagnosticMode({ questions, onComplete }: DiagnosticModeProps) {
  const router = useRouter();

  const flow = useDiagnosticFlow(questions, (result) => {
    onComplete?.({
      accuracy: result.accuracy,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
    });
  });

  const handleGoBack = () => {
    router.push('/assessment');
  };

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
              onClick={flow.handleSubmit}
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

    return (
      <DiagnosticResult
        result={flow.result}
        onRestart={flow.handleRestart}
        onViewAnalysis={() => router.push('/analyze')}
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
          <p className="text-on-surface-variant">{flow.error?.message || '请重试'}</p>
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
