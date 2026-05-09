'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BookOpen, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClozeInput, parseAnswers } from './ClozeInput';
import { ProgressIndicator } from './ProgressIndicator';
import { FeedbackCard } from './FeedbackCard';
import { QuestionRenderer, type QuestionData } from './QuestionRenderer';
import { usePracticeFlow, type PracticeQuestion } from '@/hooks/usePracticeFlow';
import { BehaviorBadge, FeedbackPopup, DifficultyChange, useDifficultyNotification, type BehaviorTag } from '@/components/BehaviorFeedback';
import { calculateBehaviorTag } from '@/lib/adaptive-difficulty';

// XP奖励常量
const XP_REWARDS = {
  REMEMBERED: 10,
  FORGOT: 2,
};

// 行为反馈显示时长（毫秒）
const BEHAVIOR_FEEDBACK_DURATION = 2000;

interface TrainingModeProps {
  questions: PracticeQuestion[];
  onComplete?: (results: { total: number; correct: number; xpEarned: number }) => void;
  onFeedback?: (questionId: string, remembered: boolean) => Promise<{ masteryBefore: number; masteryAfter: number } | null>;
  onDifficultyChange?: (newLevel: number) => void;
}

export function TrainingMode({ questions, onComplete, onFeedback, onDifficultyChange }: TrainingModeProps) {
  const router = useRouter();
  const [xpEarned, setXpEarned] = useState(0);
  const [feedbackState, setFeedbackState] = useState<{
    masteryBefore: number;
    masteryAfter: number;
    correctAnswer: string;
    explanation?: string;
  } | null>(null);

  // 行为反馈状态
  const [currentBehavior, setCurrentBehavior] = useState<BehaviorTag | null>(null);
  const [showBehaviorPopup, setShowBehaviorPopup] = useState(false);

  // 答题开始时间
  const answerStartTimeRef = useRef<number>(0);

  // 难度变更通知
  const { notification: difficultyNotification, showNotification, closeNotification, NotificationComponent: DifficultyNotificationComponent } = useDifficultyNotification();

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
  }, (questionIndex, remembered) => {
    // 每答完一题就更新XP
    const xpToAdd = remembered ? XP_REWARDS.REMEMBERED : XP_REWARDS.FORGOT;
    setXpEarned(prev => prev + xpToAdd);
  });

  // 监听难度变化并通知父组件
  useEffect(() => {
    if (flow.difficultyAdjustment?.shouldAdjust) {
      onDifficultyChange?.(flow.difficultyLevel);
      showNotification(
        flow.difficultyAdjustment.newLevel > flow.difficultyLevel ? 'up' : 'down',
        flow.difficultyAdjustment.reason
      );
    }
  }, [flow.difficultyAdjustment, flow.difficultyLevel, onDifficultyChange, showNotification]);

  // 开始答题时记录时间
  const handleStartAnswer = useCallback(() => {
    answerStartTimeRef.current = Date.now();
  }, []);

  // 监听题目切换，自动记录答题开始时间
  useEffect(() => {
    if (flow.state === 'answering' && flow.currentQuestion) {
      handleStartAnswer();
    }
  }, [flow.currentIndex, flow.state, flow.currentQuestion, handleStartAnswer]);

  const handleGoBack = () => {
    router.push('/');
  };

  // 处理记住/忘记按钮
  const handleRemembered = useCallback(() => {
    console.log('[TrainingMode] handleRemembered called');
    const duration = Date.now() - answerStartTimeRef.current;
    const behavior = calculateBehaviorTag(duration, true) as BehaviorTag;
    setCurrentBehavior(behavior);
    setShowBehaviorPopup(true);

    // 显示行为标签后自动关闭
    setTimeout(() => setShowBehaviorPopup(false), BEHAVIOR_FEEDBACK_DURATION);

    flow.handleFeedback(true, duration);
  }, [flow]);

  const handleForgot = useCallback(() => {
    const duration = Date.now() - answerStartTimeRef.current;
    const behavior = calculateBehaviorTag(duration, false) as BehaviorTag;
    setCurrentBehavior(behavior);
    setShowBehaviorPopup(true);

    // 显示行为标签后自动关闭
    setTimeout(() => setShowBehaviorPopup(false), BEHAVIOR_FEEDBACK_DURATION);

    flow.handleFeedback(false, duration);
  }, [flow]);

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
          'border border-outline/20',
          'relative' // 用于定位 BehaviorBadge
        )}>
          {/* 行为标签 - 秒数显示 */}
          {currentBehavior && (
            <BehaviorBadge
              tag={currentBehavior}
              show={flow.state === 'answering'}
              position="top-right"
            />
          )}

          {question.type === 'fill_blank' ? (
            <div className="p-4 bg-surface-container-low rounded-2xl">
              <ClozeInput
                question={question.question}
                answers={parsedAnswers}
                userAnswers={flow.userAnswers}
                onAnswerChange={(index, value) => {
                  flow.handleAnswerChange(index, value);
                }}
              />
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
            onClick={() => {
              handleStartAnswer();
              flow.showAnswer();
            }}
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
    if (!question) return null;

    return (
      <FeedbackCard
        correctAnswer={feedbackState?.correctAnswer || (Array.isArray(question.answer) ? question.answer[0] : question.answer) || ''}
        explanation={feedbackState?.explanation || question.explanation}
        masteryBefore={feedbackState?.masteryBefore ?? 0}
        masteryAfter={feedbackState?.masteryAfter ?? 0}
        onRemembered={handleRemembered}
        onForgot={handleForgot}
      />
    );
  };

  // 渲染完成状态
  const renderCompletedState = () => {
    return (
      <div className="text-center space-y-6 py-8">
        {/* 再测评提示（满足条件时显示） */}
        {flow.totalAnswered >= 10 && flow.accuracy >= 90 && (
          <div className={cn(
            'p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50',
            'border-2 border-green-500 text-left'
          )}>
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏆</div>
              <div className="flex-1">
                <div className="font-bold text-green-800">掌握度达标！</div>
                <div className="text-sm text-green-700">
                  已完成{flow.totalAnswered}题，正确率{flow.accuracy}%
                </div>
                <div className="text-xs text-green-600 mt-1">
                  建议重新测评验证学习成果
                </div>
              </div>
              <button
                onClick={() => router.push('/assessment/diagnostic')}
                className={cn(
                  'px-4 py-2 rounded-full font-semibold',
                  'bg-green-600 text-white',
                  'hover:bg-green-700 transition-colors'
                )}
              >
                重新测评
              </button>
            </div>
          </div>
        )}

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
          <p className="text-xs text-on-surface-variant">
            即时反馈，深入理解
            {/* 难度等级 */}
            <span className="ml-2 text-primary">
              Lv.{flow.difficultyLevel}
            </span>
          </p>
        </div>
        {/* XP显示 */}
        <div className="ml-auto flex items-center gap-2">
          {/* 连续正确提示 */}
          {flow.consecutiveCorrect > 0 && (
            <span className={cn(
              'px-2 py-1 rounded-full text-xs font-bold',
              'bg-success-container text-on-success-container'
            )}>
              {flow.consecutiveCorrect}连
            </span>
          )}
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

      {/* 行为反馈弹窗 */}
      {showBehaviorPopup && currentBehavior && (
        <FeedbackPopup
          behavior={currentBehavior}
          duration={BEHAVIOR_FEEDBACK_DURATION}
          onClose={() => setShowBehaviorPopup(false)}
        />
      )}

      {/* 难度变更通知 */}
      {DifficultyNotificationComponent}
    </div>
  );
}
