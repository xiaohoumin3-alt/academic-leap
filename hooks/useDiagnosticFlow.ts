'use client';

import { useState, useCallback } from 'react';
import { calculateNextDiagnosticDifficulty, shouldEnterPracticeMode, isDiagnosticBoundaryCase } from '@/lib/adaptive-difficulty';

export type DiagnosticState = 'answering' | 'submitting' | 'result' | 'loading' | 'error';

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
  answers?: (string | null)[]; // 添加答案数组
}

// 新增：诊断动作类型
export type DiagnosticAction = 'enter_practice' | 'retry_diagnostic';

// 新增：自适应动作
export interface AdaptiveAction {
  type: DiagnosticAction;
  nextDifficulty?: number;
  reason?: string;  // 边界情况原因
}

// 新增：扩展选项
export interface DiagnosticFlowOptions {
  currentDifficulty?: number;
  onDifficultyChange?: (newDifficulty: number) => void;
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
  adaptiveAction?: AdaptiveAction;  // 新增：自适应动作

  // 操作
  handleAnswer: (answer: string) => void;
  handleNext: () => void;
  handleSubmit: () => Promise<void>;
  handleRestart: () => void;
  retry: () => void;
  handleDiagnosticComplete: (result: DiagnosticResult) => AdaptiveAction;  // 新增：处理测评完成

  // 辅助
  isLastQuestion: boolean;
  hasAnswered: boolean;
}

// 新增：诊断决策函数（独立于hook）
export function getDiagnosticDecision(
  currentDifficulty: number,
  accuracy: number
): AdaptiveAction {
  // 检查边界情况
  const boundary = isDiagnosticBoundaryCase(currentDifficulty, accuracy);
  if (boundary.isBoundary) {
    return { type: 'enter_practice', reason: boundary.reason };
  }

  // 判断是否进入练习
  if (shouldEnterPracticeMode(accuracy)) {
    return { type: 'enter_practice' };
  }

  // 计算新难度并返回重新测评动作
  const nextDifficulty = calculateNextDiagnosticDifficulty(currentDifficulty, accuracy);
  return { type: 'retry_diagnostic', nextDifficulty };
}

export function useDiagnosticFlow(
  questions: DiagnosticQuestion[],
  onComplete?: (result: DiagnosticResult) => void,
  options: DiagnosticFlowOptions = {}
): DiagnosticFlowResult {
  const [answers, setAnswers] = useState<(string | null)[]>(new Array(questions.length).fill(null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<DiagnosticState>('answering');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [adaptiveAction, setAdaptiveAction] = useState<AdaptiveAction | undefined>(undefined);

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

  // 标准化答案：如果是选择题（格式如 "A. xxx"），提取首字母
  const normalizeAnswer = (ans: string): string => {
    if (!ans) return '';
    const trimmed = ans.trim();
    // 检查是否是选择题格式（A. B. C. D. 开头）
    const match = trimmed.match(/^([A-D])[.\s]/);
    if (match) {
      return match[1].toUpperCase();
    }
    return trimmed;
  };

  // 检查答案是否正确
  const checkAnswer = (userAnswer: string | null, correctAnswer: string | string[]): boolean => {
    if (userAnswer === null) return false;

    if (Array.isArray(correctAnswer)) {
      if (typeof userAnswer === 'string') {
        const normalizedUserAnswer = normalizeAnswer(userAnswer).toLowerCase();
        return correctAnswer.some(ans => normalizeAnswer(ans).toLowerCase() === normalizedUserAnswer);
      }
      return false;
    }

    return normalizeAnswer(userAnswer).toLowerCase() === normalizeAnswer(correctAnswer).toLowerCase();
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

        // 调试：记录每道题的检查结果（清晰格式）
        const normalizedUser = normalizeAnswer(userAnswer || '');
        const correctAnswer = Array.isArray(q.answer) ? q.answer[0] : q.answer;
        const normalizedCorrect = normalizeAnswer(correctAnswer);
        console.log(`[useDiagnosticFlow] Q${i + 1}: user="${userAnswer}" → "${normalizedUser}" | correct="${correctAnswer}" → "${normalizedCorrect}" | ${isCorrect ? '✓正确' : '✗错误'}`);


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
        answers, // 添加答案数组
      };

      console.log('[useDiagnosticFlow] Final result: accuracy=' + finalResult.accuracy + '%, correct=' + correctCount + '/' + totalQuestions);

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

  // 新增：处理测评完成后的决策
  const handleDiagnosticComplete = useCallback((diagResult: DiagnosticResult): AdaptiveAction => {
    const currentDifficulty = options.currentDifficulty ?? 6;
    const { accuracy } = diagResult;

    // 使用决策函数
    const action = getDiagnosticDecision(currentDifficulty, accuracy);

    // 触发难度变化回调
    if (action.type === 'retry_diagnostic' && action.nextDifficulty !== undefined) {
      options.onDifficultyChange?.(action.nextDifficulty);
    } else if (action.type === 'enter_practice') {
      options.onDifficultyChange?.(currentDifficulty);
    }

    // 更新自适应动作状态
    setAdaptiveAction(action);
    return action;
  }, [options]);

  return {
    state,
    currentIndex,
    totalQuestions,
    currentQuestion,
    answers,
    result,
    progress,
    error: error || undefined,
    adaptiveAction,  // 新增
    handleAnswer,
    handleNext,
    handleSubmit,
    handleRestart,
    retry,
    handleDiagnosticComplete,  // 新增
    isLastQuestion: currentIndex === totalQuestions - 1,
    hasAnswered: answers[currentIndex] !== null,
  };
}
