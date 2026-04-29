/**
 * UOK Experiment Layer - Minimal Integration
 *
 * 不改变现有 UI，只做：
 * 1. 替换推荐入口
 * 2. 记录对照数据
 * 3. console 输出统计
 */

'use client';

import { useEffect, useRef } from 'react';
import { useUOKFlow } from '@/hooks/useUOKFlow';
import { experimentTracker } from '@/lib/qie/experiment-tracker';

interface UOKExperimentLayerProps {
  children: (props: {
    getNextQuestion: () => Promise<any>;
    submitAnswer: (questionId: string, isCorrect: boolean) => Promise<number | null>;
    isLoading: boolean;
  }) => React.ReactNode;
}

export default function UOKExperimentLayer({ children }: UOKExperimentLayerProps) {
  const { getNextQuestion, submitAnswer, isLoading } = useUOKFlow();
  const hasInitialized = useRef(false);

  // 自动开始第一题
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      getNextQuestion();
    }
  }, [getNextQuestion]);

  // 答题后自动下一题
  const handleSubmitAnswer = async (questionId: string, isCorrect: boolean) => {
    const probability = await submitAnswer(questionId, isCorrect);

    // 延迟一下再加载下一题，让用户看到反馈
    setTimeout(() => {
      getNextQuestion();
    }, 1500);

    return probability;
  };

  // 定期输出统计（每5题）
  useEffect(() => {
    const interval = setInterval(() => {
      const entries = experimentTracker.getEntries();
      if (entries.length > 0 && entries.length % 5 === 0) {
        experimentTracker.report();
      }
    }, 10000); // 每10秒检查一次

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {children({
        getNextQuestion,
        submitAnswer: handleSubmitAnswer,
        isLoading,
      })}

      {/* 隐藏的调试信息 - 开发环境可见 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 text-xs text-on-surface-variant/50">
          🧪 UOK Experiment: {experimentTracker.getEntries().length} entries
        </div>
      )}
    </>
  );
}

/**
 * 使用示例：
 *
 * <UOKExperimentLayer>
 *   {({ getNextQuestion, submitAnswer, isLoading }) => (
 *     <ExercisePage
 *       onLoadQuestion={getNextQuestion}
 *       onSubmitAnswer={submitAnswer}
 *       isLoading={isLoading}
 *     />
 *   )}
 * </UOKExperimentLayer>
 */
