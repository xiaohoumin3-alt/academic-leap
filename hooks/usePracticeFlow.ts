'use client';

import { useState, useCallback } from 'react';

export type PracticeState = 'answering' | 'showing_answer' | 'completed' | 'error';

export interface PracticeQuestion {
  id: string;
  type: 'fill_blank' | 'multiple_choice' | 'short_answer';
  question: string;
  answer: string | string[];
  options?: string[];
  explanation?: string;
}

export interface PracticeContext {
  state: PracticeState;
  currentIndex: number;
  totalQuestions: number;
  userAnswers: string[];
  masteryBefore: number;
  masteryAfter: number;
  error?: Error;
}

export interface PracticeFlowResult {
  // 状态
  state: PracticeState;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: PracticeQuestion | null;
  userAnswers: string[];
  masteryBefore: number;
  masteryAfter: number;
  masteryChange: number;
  progress: number;
  error?: Error;

  // 操作
  showAnswer: () => void;
  handleFeedback: (remembered: boolean) => void;
  handleAnswerChange: (index: number, value: string) => void;
  reset: () => void;
  retry: () => void;
}

export function usePracticeFlow(
  questions: PracticeQuestion[],
  onComplete?: (results: { total: number; correct: number }) => void,
  onFeedback?: (questionId: string, remembered: boolean) => Promise<{ masteryBefore: number; masteryAfter: number } | null>
): PracticeFlowResult {
  const [state, setState] = useState<PracticeState>('answering');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [masteryBefore, setMasteryBefore] = useState(0);
  const [masteryAfter, setMasteryAfter] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  // 进度计算
  const progress = totalQuestions > 0
    ? ((currentIndex + (state === 'showing_answer' || state === 'completed' ? 1 : 0)) / totalQuestions) * 100
    : 0;

  const masteryChange = masteryAfter - masteryBefore;

  // 显示答案
  const showAnswer = useCallback(() => {
    if (state === 'answering') {
      setState('showing_answer');
    }
  }, [state]);

  // 处理反馈（记住了/记错了）
  const handleFeedback = useCallback(async (remembered: boolean) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    try {
      // 调用UOK反馈API
      if (onFeedback) {
        const feedback = await onFeedback(currentQ.id, remembered);
        if (feedback) {
          setMasteryBefore(feedback.masteryBefore);
          setMasteryAfter(feedback.masteryAfter);
        }
      }

      // 移动到下一题或完成
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
        setState('answering');
        setUserAnswers([]);
      } else {
        setState('completed');
        onComplete?.({ total: totalQuestions, correct: currentIndex + (remembered ? 1 : 0) });
      }
    } catch (err) {
      setError(err as Error);
      setState('error');
    }
  }, [currentIndex, totalQuestions, questions, onComplete, onFeedback]);

  // 处理答案变化
  const handleAnswerChange = useCallback((index: number, value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[index] = value;
    setUserAnswers(newAnswers);
  }, [userAnswers]);

  // 重置
  const reset = useCallback(() => {
    setCurrentIndex(0);
    setState('answering');
    setUserAnswers([]);
    setMasteryBefore(0);
    setMasteryAfter(0);
    setError(null);
  }, []);

  // 重试
  const retry = useCallback(() => {
    setError(null);
    setState('answering');
  }, []);

  return {
    state,
    currentIndex,
    totalQuestions,
    currentQuestion,
    userAnswers,
    masteryBefore,
    masteryAfter,
    masteryChange,
    progress,
    error: error || undefined,
    showAnswer,
    handleFeedback,
    handleAnswerChange,
    reset,
    retry,
  };
}
