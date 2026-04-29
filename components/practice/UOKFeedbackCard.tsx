'use client';

import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

export interface UOKFeedbackData {
  beforeProbability: number;
  randomProbability: number; // NEW: what random would predict
  masteryBefore: number;
  masteryAfter: number;
  nextTargetComplexity: number;
  isCorrect: boolean;
}

interface UOKFeedbackCardProps {
  data: UOKFeedbackData;
  compact?: boolean;
}

export default function UOKFeedbackCard({ data, compact = false }: UOKFeedbackCardProps) {
  const { beforeProbability, randomProbability, masteryBefore, masteryAfter, nextTargetComplexity, isCorrect } = data;

  // Calculate improvement over random
  const uokAdvantage = beforeProbability - randomProbability;
  const uokAdvantagePercent = Math.round(uokAdvantage * 100);

  const masteryChange = masteryAfter - masteryBefore;
  const masteryChangePercent = Math.round(masteryChange * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 bg-surface-container-lowest rounded-2xl">
        {/* UOK vs Random Comparison */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">UOK</span>
          <span className="text-sm font-bold text-primary">
            {Math.round(beforeProbability * 100)}%
          </span>
          <span className="text-xs text-on-surface-variant">vs</span>
          <span className="text-sm font-bold text-on-surface-variant">
            Random {Math.round(randomProbability * 100)}%
          </span>
          {uokAdvantagePercent > 5 && (
            <span className="text-xs font-bold text-success">
              +{uokAdvantagePercent}%
            </span>
          )}
        </div>

        <div className="w-px h-4 bg-surface-container-highest" />

        {/* Prediction vs Actual */}
        <div className="flex items-center gap-2">
          <MaterialIcon
            icon={isCorrect ? "check_circle" : "cancel"}
            className={cn(
              "w-5 h-5",
              isCorrect ? "text-success" : "text-error"
            )}
          />
          <div className="text-sm">
            <span className={cn(
              "font-bold",
              isCorrect ? "text-success" : "text-error"
            )}>
              {isCorrect ? "正确" : "错误"}
            </span>
          </div>
        </div>

        {/* Mastery Change */}
        <div className="w-px h-4 bg-surface-container-highest" />

        <div className="flex items-center gap-2">
          <MaterialIcon
            icon={masteryAfter >= masteryBefore ? "trending_up" : "trending_down"}
            className={cn(
              "w-4 h-4",
              masteryAfter >= masteryBefore ? "text-primary" : "text-error"
            )}
          />
          <div className="text-sm">
            <span className="font-bold text-on-surface">
              {Math.round(masteryAfter * 100)}%
            </span>
            <span className={cn(
              "text-xs ml-1",
              masteryAfter >= masteryBefore ? "text-primary" : "text-error"
            )}>
              ({masteryAfter >= masteryBefore ? '+' : ''}{Math.round((masteryAfter - masteryBefore) * 100)}%)
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-[2rem] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-tertiary-container flex items-center justify-center">
          <MaterialIcon icon="psychology" className="w-5 h-5 text-on-tertiary-container" />
        </div>
        <div>
          <div className="text-lg font-display font-black text-on-surface">
            UOK 学习反馈
          </div>
          <div className="text-xs text-on-surface-variant">
            ML 预测 · 掌握度更新 · 下题目标
          </div>
        </div>
      </div>

      {/* UOK vs Random Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "rounded-2xl p-4",
          isCorrect
            ? "bg-success-container/30"
            : "bg-error-container/30"
        )}>
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon
              icon="auto_awesome"
              className={cn(
                "w-4 h-4",
                isCorrect ? "text-success" : "text-error"
              )}
            />
            <span className="text-sm text-on-surface-variant">UOK 推荐预测</span>
          </div>
          <div className="text-3xl font-display font-black text-on-surface">
            {Math.round(beforeProbability * 100)}%
          </div>
          <div className={cn(
            "text-sm font-bold mt-1",
            isCorrect ? "text-success" : "text-error"
          )}>
            {isCorrect ? "预测正确 ✅" : "预测错误 ❌"}
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-surface-container">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon icon="shuffle" className="w-4 h-4 text-on-surface-variant" />
            <span className="text-sm text-on-surface-variant">Random 预测</span>
            {uokAdvantagePercent > 5 && (
              <span className="ml-auto text-xs font-bold text-success">
                +{uokAdvantagePercent}%
              </span>
            )}
          </div>
          <div className="text-3xl font-display font-black text-on-surface-variant">
            {Math.round(randomProbability * 100)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            如果用 random 选择
          </div>
        </div>
      </div>

      {/* Mastery Change */}
      <div className={cn(
        "rounded-2xl p-4",
        masteryAfter >= masteryBefore
          ? "bg-primary-container/30"
          : "bg-error-container/30"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <MaterialIcon icon="school" className="w-4 h-4 text-primary" />
          <span className="text-sm text-on-surface-variant">掌握度变化</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-display font-black text-on-surface">
            {Math.round(masteryBefore * 100)}%
          </span>
          <MaterialIcon icon="arrow_forward" className="w-4 h-4 text-on-surface-variant" />
          <span className={cn(
            "text-2xl font-display font-black",
            masteryAfter >= masteryBefore ? "text-primary" : "text-error"
          )}>
            {Math.round(masteryAfter * 100)}%
          </span>
        </div>
        <div className={cn(
          "text-sm font-bold mt-1",
          masteryAfter >= masteryBefore ? "text-primary" : "text-error"
        )}>
          {masteryAfter >= masteryBefore ? '+' : ''}{Math.round((masteryAfter - masteryBefore) * 100)}%
          {masteryAfter >= masteryBefore ? ' 提升' : ' 下降'}
        </div>
      </div>

      {/* Next Target */}
      <div className="px-5 py-4 bg-surface-container-low rounded-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MaterialIcon icon="next_plan" className="w-5 h-5 text-tertiary" />
            <div>
              <div className="text-sm text-on-surface-variant">下题目标复杂度</div>
              <div className="text-lg font-bold text-on-surface">
                {Math.round(nextTargetComplexity * 100)}%
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-on-surface-variant">复杂度</div>
            <div className="flex items-center gap-1">
              <MaterialIcon icon="show_chart" className="w-4 h-4 text-tertiary" />
              <span className="text-sm font-bold text-tertiary">
                {nextTargetComplexity < 0.4 ? '简单' : nextTargetComplexity < 0.7 ? '中等' : '复杂'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Insight Message */}
      <div className="flex items-start gap-3 px-4 py-3 bg-tertiary-container/20 rounded-2xl">
        <MaterialIcon icon="lightbulb" className="w-5 h-5 text-tertiary mt-0.5" />
        <div className="text-sm text-on-surface-variant">
          {isCorrect && masteryChange > 0.05
            ? "掌握度显著提升！下题将适当增加复杂度以保持挑战性。"
            : isCorrect
            ? "回答正确！继续巩固当前知识点。"
            : masteryChange < -0.05
            ? "掌握度有所下降，下题将降低复杂度帮助找回信心。"
            : "继续练习，UOK 正在学习你的答题模式。"}
        </div>
      </div>
    </div>
  );
}
