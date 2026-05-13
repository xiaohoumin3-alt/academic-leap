'use client';

import { useState, useCallback, useRef } from 'react';
import { calculateDifficultyAdjustment, type DifficultyAdjustment } from '@/lib/adaptive-difficulty';

export type PracticeState = 'answering' | 'showing_answer' | 'completed' | 'error';

export interface PracticeQuestion {
  id: string;
  type: 'fill_blank' | 'multiple_choice' | 'short_answer' | 'calculation';
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

  // 难度自适应状态
  difficultyLevel: number;
  consecutiveCorrect: number;
  totalAnswered: number;
  correctCount: number;      // 新增：正确答题数
  accuracy: number;          // 新增：正确率百分比 (correctCount / totalAnswered * 100)
  difficultyAdjustment: DifficultyAdjustment | null;

  // 操作
  showAnswer: () => void;
  handleFeedback: (remembered: boolean, answerDuration?: number) => void;
  handleAnswerChange: (index: number, value: string) => void;
  reset: () => void;
  retry: () => void;
}

export function usePracticeFlow(
  questions: PracticeQuestion[],
  onComplete?: (results: { total: number; correct: number }) => void,
  onFeedback?: (questionId: string, remembered: boolean) => Promise<{ masteryBefore: number; masteryAfter: number } | null>,
  onQuestionAnswered?: (questionIndex: number, remembered: boolean) => void,
  initialDifficultyLevel: number = 2
): PracticeFlowResult {
  const [state, setState] = useState<PracticeState>('answering');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [masteryBefore, setMasteryBefore] = useState(0);
  const [masteryAfter, setMasteryAfter] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // 难度自适应状态
  const [difficultyLevel, setDifficultyLevel] = useState(initialDifficultyLevel);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);  // 新增：正确答题数
  const [difficultyAdjustment, setDifficultyAdjustment] = useState<DifficultyAdjustment | null>(null);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  // 进度计算
  const progress = totalQuestions > 0
    ? ((currentIndex + (state === 'showing_answer' || state === 'completed' ? 1 : 0)) / totalQuestions) * 100
    : 0;

  const masteryChange = masteryAfter - masteryBefore;

  // 计算正确率
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  // 显示答案
  const showAnswer = useCallback(() => {
    if (state === 'answering') {
      setState('showing_answer');
    }
  }, [state]);

  // 处理反馈（记住了/记错了）
  const handleFeedback = useCallback(async (remembered: boolean, answerDuration: number = 0) => {
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

      // 更新难度自适应状态
      const config = {
        level: difficultyLevel,
        consecutiveCorrect,
        consecutiveWrong: 0, // 简化处理
        recentAccuracy: totalAnswered > 0 ? (consecutiveCorrect / totalAnswered) : 0,
        totalAnswered,
      };

      const adjustment = calculateDifficultyAdjustment(config, remembered);

      // 应用难度调整
      if (adjustment.shouldAdjust) {
        setDifficultyLevel(adjustment.newLevel);
        setDifficultyAdjustment(adjustment);
      } else {
        setDifficultyAdjustment(null);
      }

      // 更新连续正确计数和总答题数
      if (remembered) {
        setConsecutiveCorrect(prev => prev + 1);
        setCorrectCount(prev => prev + 1);
      } else {
        setConsecutiveCorrect(0);
      }
      setTotalAnswered(prev => prev + 1);

      // 通知每题完成（用于更新XP等）
      onQuestionAnswered?.(currentIndex, remembered);

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
  }, [currentIndex, totalQuestions, questions, onComplete, onFeedback, difficultyLevel, consecutiveCorrect, totalAnswered]);

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
    setDifficultyLevel(initialDifficultyLevel);
    setConsecutiveCorrect(0);
    setTotalAnswered(0);
    setCorrectCount(0);
    setDifficultyAdjustment(null);
  }, [initialDifficultyLevel]);

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
    difficultyLevel,
    consecutiveCorrect,
    totalAnswered,
    correctCount,
    accuracy,
    difficultyAdjustment,
    showAnswer,
    handleFeedback,
    handleAnswerChange,
    reset,
    retry,
  };
}
