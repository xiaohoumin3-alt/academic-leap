'use client';

import { Check, X, ChevronRight, RefreshCw, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticResult as DiagnosticResultType, AdaptiveAction } from '@/hooks/useDiagnosticFlow';

interface DiagnosticResultProps {
  result: DiagnosticResultType;
  onRestart: () => void;
  onViewAnalysis: () => void;
  currentDifficulty?: number;
  adaptiveAction?: AdaptiveAction;
  onRetryDiagnostic?: (nextDifficulty: number) => void;
  onEnterPractice?: () => void;
}

/**
 * 诊断结果展示组件
 * 显示正确率、错题回顾
 */
export function DiagnosticResult({
  result,
  onRestart,
  onViewAnalysis,
  currentDifficulty,
  adaptiveAction,
  onRetryDiagnostic,
  onEnterPractice,
}: DiagnosticResultProps) {
  const { accuracy, correctCount, wrongCount, wrongQuestions, earnedXP } = result;

  return (
    <div className="space-y-6">
      {/* 得分卡片 */}
      <div className={cn(
        'p-8 rounded-2xl bg-surface-container text-center',
        'border border-outline/20'
      )}>
        <div className="text-6xl font-bold mb-2">
          <span className={cn(
            accuracy >= 80 && 'text-success',
            accuracy >= 60 && accuracy < 80 && 'text-tertiary',
            accuracy < 60 && 'text-error'
          )}>
            {accuracy}%
          </span>
        </div>
        <div className="text-sm text-on-surface-variant mb-6">正确率</div>

        <div className="flex justify-center gap-8 mb-8">
          <div className="text-center">
            <div className={cn(
              'text-3xl font-bold',
              correctCount > 0 ? 'text-success' : 'text-on-surface-variant'
            )}>
              {correctCount}
            </div>
            <div className="text-xs text-on-surface-variant flex items-center justify-center gap-1">
              <Check className="w-3 h-3" />
              正确
            </div>
          </div>
          <div className="text-center">
            <div className={cn(
              'text-3xl font-bold',
              wrongCount > 0 ? 'text-error' : 'text-on-surface-variant'
            )}>
              {wrongCount}
            </div>
            <div className="text-xs text-on-surface-variant flex items-center justify-center gap-1">
              <X className="w-3 h-3" />
              错误
            </div>
          </div>
        </div>

        {/* XP奖励 */}
        <div className={cn(
          'p-4 rounded-2xl inline-block',
          earnedXP > 0 ? 'bg-tertiary-container/30' : 'bg-surface-container-high'
        )}>
          <div className={cn(
            'text-2xl font-bold',
            earnedXP > 0 ? 'text-tertiary' : 'text-on-surface-variant'
          )}>
            +{earnedXP} XP
          </div>
          <div className="text-xs text-on-surface-variant">获得奖励</div>
        </div>
      </div>

      {/* 错题回顾 */}
      {wrongQuestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-on-surface">错题回顾</h3>
          {wrongQuestions.map((item, index) => (
            <div
              key={item.question.id}
              className={cn(
                'p-4 rounded-2xl bg-error-container/10',
                'border-2 border-error/30'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                  'bg-error-container'
                )}>
                  <X className="w-4 h-4 text-error" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-on-surface leading-relaxed">
                    {item.question.question}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-on-surface-variant">你的答案：</span>
                      <span className="text-error font-semibold">
                        {typeof item.userAnswer === 'string'
                          ? item.userAnswer || '(未作答)'
                          : Array.isArray(item.userAnswer) ? item.userAnswer[0] : '(未作答)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant">正确答案：</span>
                      <span className="text-success font-semibold">
                        {typeof item.question.answer === 'string'
                          ? item.question.answer
                          : item.question.answer[0]}
                      </span>
                    </div>
                  </div>
                  {item.question.explanation && (
                    <div className="text-xs text-on-surface-variant mt-2 p-2 bg-surface-container rounded-lg">
                      {item.question.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 全对提示 */}
      {wrongQuestions.length === 0 && (
        <div className={cn(
          'p-6 rounded-2xl bg-success-container/20',
          'border-2 border-success/30 text-center'
        )}>
          <div className="text-4xl mb-2">
            <span className="text-success">🎉</span>
          </div>
          <h3 className="text-lg font-bold text-success mb-1">太棒了！</h3>
          <p className="text-sm text-on-surface-variant">所有题目都回答正确，继续保持！</p>
        </div>
      )}

      {/* 操作按钮 - 自适应逻辑 */}
      <div className="flex justify-center gap-4">
        {/* 重新测评按钮（自适应动作） */}
        {adaptiveAction?.type === 'retry_diagnostic' && onRetryDiagnostic && (
          <button
            onClick={() => onRetryDiagnostic(adaptiveAction.nextDifficulty!)}
            className={cn(
              'px-8 py-3 rounded-full font-semibold flex items-center gap-2',
              'bg-tertiary text-white',
              'hover:bg-tertiary/90 transition-colors'
            )}
          >
            <RefreshCw className="w-4 h-4" />
            重新测评
            {currentDifficulty && adaptiveAction.nextDifficulty && (
              <span className="text-sm font-normal opacity-80">
                (难度 {currentDifficulty} → {adaptiveAction.nextDifficulty})
              </span>
            )}
            {adaptiveAction.reason && (
              <span className="text-xs opacity-80">({adaptiveAction.reason})</span>
            )}
          </button>
        )}

        {/* 进入练习按钮（自适应动作） */}
        {adaptiveAction?.type === 'enter_practice' && onEnterPractice && (
          <button
            onClick={onEnterPractice}
            className={cn(
              'px-8 py-3 rounded-full font-semibold flex items-center gap-2',
              'bg-success text-white',
              'hover:bg-success/90 transition-colors'
            )}
          >
            <Brain className="w-4 h-4" />
            开始查漏补缺
            {adaptiveAction.reason && (
              <span className="text-xs opacity-80">({adaptiveAction.reason})</span>
            )}
          </button>
        )}

        {/* 默认按钮（无自适应动作时） */}
        {!adaptiveAction && (
          <>
            <button
              onClick={onRestart}
              className={cn(
                'px-6 py-3 rounded-full font-semibold',
                'bg-surface-container text-on-surface',
                'hover:bg-surface-container-high transition-colors',
                'border border-outline'
              )}
            >
              再测一次
            </button>
            <button
              onClick={onViewAnalysis}
              className={cn(
                'px-6 py-3 rounded-full font-semibold flex items-center gap-2',
                'bg-primary text-white',
                'hover:bg-primary/90 transition-colors'
              )}
            >
              查看完整分析
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* 查看分析按钮（始终显示） */}
        {adaptiveAction && (
          <button
            onClick={onViewAnalysis}
            className={cn(
              'px-6 py-3 rounded-full font-semibold flex items-center gap-2',
              'bg-surface-container text-on-surface',
              'hover:bg-surface-container-high transition-colors',
              'border border-outline'
            )}
          >
            查看分析
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
