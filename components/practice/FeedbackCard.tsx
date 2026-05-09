'use client';

import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

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
 * 反馈卡片 - 简化版
 * 只显示核心信息：正确答案 + 掌握度变化
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
  const isImprovement = masteryChange >= 0;

  return (
    <div className="space-y-5">
      {/* 正确答案 - 大字体显示 */}
      <div className="text-center py-4">
        <p className="text-sm text-on-surface-variant mb-2">正确答案</p>
        <p className="text-2xl font-bold text-on-surface">
          {Array.isArray(correctAnswer) ? correctAnswer[0] : correctAnswer}
        </p>
      </div>

      {/* 掌握度变化 - 简化为一个小标签 */}
      <div className="flex justify-center">
        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold',
          isImprovement
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-error-container text-on-error-container'
        )}>
          <span>
            {isImprovement ? '+' : ''}{changePercent}%
          </span>
          <span className="text-xs opacity-80">
            {isImprovement ? '掌握度提升' : '需要加强'}
          </span>
        </div>
      </div>

      {/* 解释 - 可折叠显示，默认收起 */}
      {explanation && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-on-surface-variant hover:text-on-surface transition-colors list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            查看解释
          </summary>
          <p className="mt-2 text-sm text-on-surface-variant pl-5 leading-relaxed">
            {explanation}
          </p>
        </details>
      )}

      {/* 操作按钮 - 简化样式，更大更清晰 */}
      <div className="flex gap-3 pt-2">
        {/* 记错了按钮 - 灰色样式 */}
        <button
          onClick={onForgot}
          disabled={isLoading}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 p-4 rounded-xl',
            'bg-surface-container text-on-surface font-semibold',
            'hover:bg-surface-container-high transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <X className="w-6 h-6" />
          <span>记错了</span>
          <span className="text-xs text-on-surface-variant">+2 XP</span>
        </button>

        {/* 记住了按钮 - 强调样式，深色文字 */}
        <button
          onClick={onRemembered}
          disabled={isLoading}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 p-4 rounded-xl',
            'bg-primary text-on-primary font-bold',
            'hover:bg-primary/90 transition-colors shadow-md',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Check className="w-6 h-6" />
          <span>记住了</span>
          <span className="text-xs opacity-80">+10 XP</span>
        </button>
      </div>
    </div>
  );
}
