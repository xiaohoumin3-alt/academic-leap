'use client';

import { useState, useCallback } from 'react';

export type DiagnosticState = 'answering' | 'submitting' | 'result' | 'error';

export interface DiagnosticQuestion {
  id: string;
  type: 'fill_blank' | 'multiple_choice' | 'short_answer';
  question: string;
  answer: string | string[];
  options?: string[];
  explanation?: string;
}

export interface DiagnosticWrongQuestion {
  question: DiagnosticQuestion;
  userAnswer: string | string[];
}

export interface DiagnosticResult {
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  wrongQuestions: DiagnosticWrongQuestion[];
  earnedXP: number;
}

export interface DiagnosticFlowResult {
  // 状态
  state: DiagnosticState;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: DiagnosticQuestion | null;
  answers: (string | null)[];
  result: DiagnosticResult | null;
  progress: number;
  error?: Error;

  // 操作
  handleAnswer: (answer: string) => void;
  handleNext: () => void;
  handleSubmit: () => Promise<void>;
  handleRestart: () => void;
  retry: () => void;

  // 辅助
  isLastQuestion: boolean;
  hasAnswered: boolean;
}

export function useDiagnosticFlow(
  questions: DiagnosticQuestion[],
  onComplete?: (result: DiagnosticResult) => void
): DiagnosticFlowResult {
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(questions.length).fill(null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<DiagnosticState>('answering');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] || null;

  // 进度计算：基于当前索引和答题状态
  const progress = totalQuestions > 0
    ? ((currentIndex + (answers[currentIndex] !== null ? 1 : 0)) / totalQuestions) * 100
    : 0;

  // 处理答案
  const handleAnswer = useCallback((answer: string) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);
  }, [answers, currentIndex]);

  // 下一题
  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalQuestions]);

  // 检查答案是否正确
  const checkAnswer = (userAnswer: string | null, correctAnswer: string | string[]): boolean => {
    if (userAnswer === null) return false;

    if (Array.isArray(correctAnswer)) {
      if (typeof userAnswer === 'string') {
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        return correctAnswer.some(ans => normalizedUserAnswer === ans.toLowerCase().trim());
      }
      return false;
    }

    return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  // 提交全部答案
  const handleSubmit = useCallback(async () => {
    setState('submitting');

    try {
      // 计算结果
      const wrongQuestions: DiagnosticWrongQuestion[] = [];
      let correctCount = 0;

      questions.forEach((q, i) => {
        const userAnswer = answers[i];
        const isCorrect = checkAnswer(userAnswer, q.answer);

        if (isCorrect) {
          correctCount++;
        } else {
          wrongQuestions.push({ question: q, userAnswer: userAnswer || '' });
        }
      });

      // XP奖励：每题正确+5，全对额外+50
      const baseXP = correctCount * 5;
      const bonusXP = correctCount === totalQuestions ? 50 : 0;
      const earnedXP = baseXP + bonusXP;

      const finalResult: DiagnosticResult = {
        accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
        correctCount,
        wrongCount: totalQuestions - correctCount,
        wrongQuestions,
        earnedXP,
      };

      setResult(finalResult);
      setState('result');
      onComplete?.(finalResult);
    } catch (err) {
      setError(err as Error);
      setState('error');
    }
  }, [questions, answers, totalQuestions, onComplete]);

  // 重新开始
  const handleRestart = useCallback(() => {
    setAnswers(new Array(questions.length).fill(null));
    setCurrentIndex(0);
    setState('answering');
    setResult(null);
    setError(null);
  }, [questions.length]);

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
    answers,
    result,
    progress,
    error: error || undefined,
    handleAnswer,
    handleNext,
    handleSubmit,
    handleRestart,
    retry,
    isLastQuestion: currentIndex === totalQuestions - 1,
    hasAnswered: answers[currentIndex] !== null,
  };
}
