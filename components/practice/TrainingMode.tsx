'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BookOpen, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClozeInput, parseAnswers } from './ClozeInput';
import { ProgressIndicator } from './ProgressIndicator';
import { FeedbackCard } from './FeedbackCard';
import { QuestionRenderer, type QuestionData } from './QuestionRenderer';
import { usePracticeFlow, type PracticeQuestion } from '@/hooks/usePracticeFlow';

// XP奖励常量
const XP_REWARDS = {
  REMEMBERED: 10,
  FORGOT: 2,
};

interface TrainingModeProps {
  questions: PracticeQuestion[];
  onComplete?: (results: { total: number; correct: number; xpEarned: number }) => void;
  onFeedback?: (questionId: string, remembered: boolean) => Promise<{ masteryBefore: number; masteryAfter: number } | null>;
}

export function TrainingMode({ questions, onComplete, onFeedback }: TrainingModeProps) {
  const router = useRouter();
  const [xpEarned, setXpEarned] = useState(0);
  const [feedbackState, setFeedbackState] = useState<{
    masteryBefore: number;
    masteryAfter: number;
    correctAnswer: string;
    explanation?: string;
  } | null>(null);

  const flow = usePracticeFlow(questions, async (results) => {
    const xp = results.correct * XP_REWARDS.REMEMBERED + (results.total - results.correct) * XP_REWARDS.FORGOT;
    setXpEarned(xp);
    onComplete?.({ ...results, xpEarned: xp });
  }, async (questionId, remembered) => {
    if (onFeedback) {
      const result = await onFeedback(questionId, remembered);
      if (result) {
        const question = questions.find(q => q.id === questionId);
        setFeedbackState({
          masteryBefore: result.masteryBefore,
          masteryAfter: result.masteryAfter,
          correctAnswer: Array.isArray(question?.answer) ? question!.answer[0] : (question?.answer || ''),
          explanation: question?.explanation,
        });
      }
      return result;
    }
    return null;
  });

  const handleGoBack = () => {
    router.push('/practice');
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

    // 获取用户答案
    const userAnswerStr = flow.userAnswers.join('|||');
    const parsedAnswers = Array.isArray(question.answer) ? question.answer : parseAnswers(question.answer);

    return (
      <div className="space-y-6">
        {/* 题目内容 */}
        <div className={cn(
          'p-6 rounded-2xl bg-surface-container',
          'border border-outline/20'
        )}>
          {question.type === 'fill_blank' ? (
            <div className="space-y-4">
              <p className="text-lg text-on-surface leading-relaxed">
                {question.question}
              </p>
              <div className="p-4 bg-surface-container-low rounded-2xl">
                <ClozeInput
                  question={question.question}
                  answers={parsedAnswers}
                  userAnswers={flow.userAnswers}
                  onAnswerChange={(index, value) => {
                    const newAnswers = [...flow.userAnswers];
                    newAnswers[index] = value;
                  }}
                />
              </div>
            </div>
          ) : (
            <QuestionRenderer
              question={questionData}
              userAnswer={userAnswerStr}
              onAnswerChange={(answer) => {
                flow.handleAnswerChange(0, answer);
              }}
            />
          )}
        </div>

        {/* 显示答案按钮 */}
        <div className="flex justify-center">
          <button
            onClick={flow.showAnswer}
            className={cn(
              'px-8 py-3 rounded-full font-semibold',
              'bg-primary text-white',
              'hover:bg-primary/90 transition-colors',
              'shadow-lg shadow-primary/30'
            )}
          >
            显示答案
          </button>
        </div>
      </div>
    );
  };

  // 渲染反馈状态
  const renderShowingAnswerState = () => {
    const question = flow.currentQuestion;
    if (!question || !feedbackState) return null;

    return (
      <FeedbackCard
        correctAnswer={feedbackState.correctAnswer}
        explanation={feedbackState.explanation}
        masteryBefore={feedbackState.masteryBefore}
        masteryAfter={feedbackState.masteryAfter}
        onRemembered={() => flow.handleFeedback(true)}
        onForgot={() => flow.handleFeedback(false)}
      />
    );
  };

  // 渲染完成状态
  const renderCompletedState = () => {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="w-16 h-16 rounded-full bg-success-container flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface mb-2">练习完成</h2>
          <p className="text-on-surface-variant">你已经完成了本次练习</p>
        </div>
        <div className={cn(
          'px-6 py-4 rounded-2xl bg-tertiary-container/30 inline-block'
        )}>
          <div className="text-3xl font-bold text-tertiary">+{xpEarned} XP</div>
          <div className="text-sm text-on-surface-variant">获得奖励</div>
        </div>
        <button
          onClick={handleGoBack}
          className={cn(
            'px-8 py-3 rounded-full font-semibold',
            'bg-primary text-white',
            'hover:bg-primary/90 transition-colors'
          )}
        >
          返回练习页面
        </button>
      </div>
    );
  };

  // 渲染错误状态
  const renderErrorState = () => {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto">
          <Lightbulb className="w-8 h-8 text-error" />
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
        <span>返回选择</span>
      </button>

      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-on-surface">练习模式</h1>
          <p className="text-xs text-on-surface-variant">即时反馈，深入理解</p>
        </div>
        {/* XP显示 */}
        <div className="ml-auto">
          <span className={cn(
            'px-3 py-1 rounded-full text-sm font-bold',
            'bg-tertiary-container text-on-tertiary-container'
          )}>
            +{xpEarned} XP
          </span>
        </div>
      </div>

      {/* 进度条 */}
      {flow.state !== 'completed' && flow.state !== 'error' && (
        <ProgressIndicator
          current={flow.currentIndex}
          total={flow.totalQuestions}
          progress={flow.progress}
        />
      )}

      {/* 状态渲染 */}
      {flow.state === 'answering' && renderAnsweringState()}
      {flow.state === 'showing_answer' && renderShowingAnswerState()}
      {flow.state === 'completed' && renderCompletedState()}
      {flow.state === 'error' && renderErrorState()}
    </div>
  );
}
