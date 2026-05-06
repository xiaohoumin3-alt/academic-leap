'use client';

import { cn } from '@/lib/utils';
import { Check, X, ChevronRight } from 'lucide-react';

interface FeedbackCardProps {
  correctAnswer: string | string[];
  explanation?: string;
  masteryBefore: number;
  masteryAfter: number;
  onRemembered: () => void;
  onForgot: () => void;
  isLoading?: boolean;
}

/**
 * 反馈卡片
 * 显示正确答案、解释、掌握度变化，并提供"记住了"/"记错了"按钮
 */
export function FeedbackCard({
  correctAnswer,
  explanation,
  masteryBefore,
  masteryAfter,
  onRemembered,
  onForgot,
  isLoading = false,
}: FeedbackCardProps) {
  const masteryChange = masteryAfter - masteryBefore;
  const changePercent = Math.round(masteryChange * 100);
  const beforePercent = Math.round(masteryBefore * 100);
  const afterPercent = Math.round(masteryAfter * 100);

  return (
    <div className="space-y-4">
      {/* 正确答案 */}
      <div className={cn(
        'p-6 rounded-2xl border-2',
        'bg-success-container/20 border-success'
      )}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-success flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-bold text-success uppercase tracking-wide">
            正确答案
          </span>
        </div>
        <div className="text-xl font-semibold text-on-surface">
          {Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer}
        </div>
      </div>

      {/* 解释 */}
      {explanation && (
        <div className="p-6 rounded-2xl bg-surface-container border border-outline/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-secondary-container flex items-center justify-center">
              <span className="text-sm font-bold text-on-secondary-container">i</span>
            </div>
            <span className="text-sm font-bold text-secondary uppercase tracking-wide">
              解释
            </span>
          </div>
          <div className="text-sm leading-relaxed text-on-surface-variant">
            {explanation}
          </div>
        </div>
      )}

      {/* 掌握度变化 */}
      <div className={cn(
        'p-6 rounded-2xl text-center',
        masteryAfter >= masteryBefore
          ? 'bg-primary-container/20 border-2 border-primary'
          : 'bg-error-container/20 border-2 border-error'
      )}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-2xl font-bold text-on-surface-variant">
            {beforePercent}%
          </span>
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
          <span className={cn(
            'text-3xl font-bold',
            masteryAfter >= masteryBefore ? 'text-primary' : 'text-error'
          )}>
            {afterPercent}%
          </span>
        </div>
        <div className={cn(
          'text-base font-semibold',
          masteryAfter >= masteryBefore ? 'text-primary' : 'text-error'
        )}>
          {masteryAfter >= masteryBefore ? '+' : ''}{changePercent}% 掌握度{changePercent >= 0 ? '提升' : '下降'}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-4">
        {/* 记错了按钮 */}
        <button
          onClick={onForgot}
          disabled={isLoading}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl',
            'bg-error-container text-error font-semibold',
            'hover:bg-error/20 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <X className="w-5 h-5" />
          <span>记错了</span>
          <span className="text-sm font-normal opacity-80">(+2 XP)</span>
        </button>

        {/* 记住了按钮 */}
        <button
          onClick={onRemembered}
          disabled={isLoading}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl',
            'bg-success text-white font-semibold',
            'hover:bg-success/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Check className="w-5 h-5" />
          <span>记住了</span>
          <span className="text-sm font-normal opacity-90">(+10 XP)</span>
        </button>
      </div>
    </div>
  );
}
