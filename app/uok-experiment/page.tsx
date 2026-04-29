/**
 * UOK Experiment Demo Page
 *
 * 最小化实验界面 - 用于验证 UOK 推荐引擎
 */

'use client';

import { useState } from 'react';
import { useUOKFlow } from '@/hooks/useUOKFlow';
import UOKFeedbackCard from '@/components/practice/UOKFeedbackCard';
import UOKCumulativeStats from '@/components/practice/UOKCumulativeStats';
import RecommendationRationaleDisplay from '@/components/practice/RecommendationRationale';
import { experimentTracker } from '@/lib/qie/experiment-tracker';
import MaterialIcon from '@/components/MaterialIcon';

export default function UOKExperimentPage() {
  const {
    getNextQuestion,
    submitAnswer,
    reset,
    state,
    currentQuestion,
    currentRationale,
    latestFeedback,
    history,
  } = useUOKFlow();

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handleLoadQuestion = async () => {
    await getNextQuestion();
    setSelectedAnswer(null);
  };

  const handleSubmitAnswer = async (isCorrect: boolean) => {
    if (!currentQuestion) return;
    await submitAnswer(currentQuestion.id, isCorrect);
  };

  const handleShowReport = () => {
    experimentTracker.report();
  };

  const handleReset = () => {
    reset();
    setSelectedAnswer(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-black text-on-surface">
              🧪 UOK 推荐实验
            </h1>
            <p className="text-sm text-on-surface-variant">
              对照实验：UOK vs Random
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleShowReport}
              className="px-4 py-2 bg-tertiary-container text-on-tertiary-container rounded-full text-sm font-bold"
            >
              报告
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-surface-container text-on-surface rounded-full text-sm font-bold"
            >
              重置
            </button>
          </div>
        </div>

        {/* 累计统计 */}
        {history.length > 0 && (
          <UOKCumulativeStats history={history} />
        )}

        {/* 推荐依据 */}
        {currentRationale && (
          <RecommendationRationaleDisplay
            rationale={currentRationale}
          />
        )}

        {/* 题目内容 */}
        {currentQuestion ? (
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">
                复杂度: {currentQuestion.complexity?.toFixed(2)}
              </span>
              <span className="text-sm text-on-surface-variant">
                {currentQuestion.knowledgePoints.join(', ')}
              </span>
            </div>

            <div className="text-lg text-on-surface">
              {typeof currentQuestion.content === 'string'
                ? currentQuestion.content
                : JSON.stringify(currentQuestion.content)}
            </div>

            {/* 答案按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => handleSubmitAnswer(true)}
                disabled={state.isSubmittingAnswer}
                className={`
                  flex-1 py-3 rounded-full font-bold transition-all
                  ${selectedAnswer === 'correct'
                    ? 'bg-success text-on-success'
                    : 'bg-success-container text-on-success-container hover:scale-105'
                  }
                  ${state.isSubmittingAnswer ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                <MaterialIcon icon="check" className="w-5 h-5 mr-1" />
                正确
              </button>
              <button
                onClick={() => handleSubmitAnswer(false)}
                disabled={state.isSubmittingAnswer}
                className={`
                  flex-1 py-3 rounded-full font-bold transition-all
                  ${selectedAnswer === 'wrong'
                    ? 'bg-error text-on-error'
                    : 'bg-error-container text-on-error-container hover:scale-105'
                  }
                  ${state.isSubmittingAnswer ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                <MaterialIcon icon="close" className="w-5 h-5 mr-1" />
                错误
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-[2rem] p-12 text-center">
            <button
              onClick={handleLoadQuestion}
              disabled={state.isLoadingQuestion}
              className="px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:scale-105 transition-all disabled:opacity-50"
            >
              {state.isLoadingQuestion ? '加载中...' : '开始实验'}
            </button>
          </div>
        )}

        {/* 反馈卡片 */}
        {latestFeedback && (
          <UOKFeedbackCard data={latestFeedback} />
        )}

        {/* 提示 */}
        <div className="text-center text-xs text-on-surface-variant/60">
          💡 打开 console 查看 UOK 报告，或输入 uokReport()
        </div>
      </div>
    </div>
  );
}
