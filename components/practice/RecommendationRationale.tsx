'use client';

import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

export interface RecommendationRationale {
  currentMastery: number;
  targetComplexity: number;
  complexityGap: number;
  reason: string;
}

interface RecommendationRationaleDisplayProps {
  rationale: RecommendationRationale;
  compact?: boolean;
}

export default function RecommendationRationaleDisplay({
  rationale,
  compact = false,
}: RecommendationRationaleDisplayProps) {
  const masteryPercent = Math.round(rationale.currentMastery * 100);
  const complexityPercent = Math.round(rationale.targetComplexity * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-surface-container-low rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <MaterialIcon icon="psychology" className="w-3.5 h-3 text-primary" />
          <span className="text-on-surface-variant">掌握度:</span>
          <span className="font-bold text-on-surface">{masteryPercent}%</span>
        </div>
        <div className="w-px h-3 bg-surface-container-highest" />
        <div className="flex items-center gap-1.5">
          <MaterialIcon icon="show_chart" className="w-3.5 h-3 text-tertiary" />
          <span className="text-on-surface-variant">目标复杂度:</span>
          <span className="font-bold text-on-surface">{complexityPercent}%</span>
        </div>
        <div className="w-px h-3 bg-surface-container-highest" />
        <div className="text-on-surface-variant/70">{rationale.reason}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center">
          <MaterialIcon icon="lightbulb" className="w-4 h-4 text-on-primary-container" />
        </div>
        <div>
          <div className="text-sm font-bold text-on-surface">推荐依据</div>
          <div className="text-xs text-on-surface-variant">UOK 推荐引擎分析</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        {/* Mastery */}
        <div className="bg-surface-container-low rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon icon="psychology" className="w-4 h-4 text-primary" />
            <span className="text-sm text-on-surface-variant">当前掌握度</span>
          </div>
          <div className="text-2xl font-display font-black text-primary">
            {masteryPercent}%
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${masteryPercent}%` }}
            />
          </div>
        </div>

        {/* Target Complexity */}
        <div className="bg-surface-container-low rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon icon="show_chart" className="w-4 h-4 text-tertiary" />
            <span className="text-sm text-on-surface-variant">目标复杂度</span>
          </div>
          <div className="text-2xl font-display font-black text-tertiary">
            {complexityPercent}%
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2">
            <div
              className="bg-tertiary h-1.5 rounded-full transition-all"
              style={{ width: `${complexityPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Complexity Gap */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low rounded-2xl">
        <span className="text-sm text-on-surface-variant">复杂度匹配度</span>
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold text-on-surface">
            {Math.max(0, 100 - Math.round(rationale.complexityGap * 100))}%
          </div>
          <MaterialIcon
            icon={rationale.complexityGap < 0.1 ? "check_circle" : "trending_up"}
            className={cn(
              "w-5 h-5",
              rationale.complexityGap < 0.1 ? "text-success" : "text-primary"
            )}
          />
        </div>
      </div>

      {/* Reason */}
      <div className="px-4 py-3 bg-primary-container/30 rounded-2xl">
        <div className="flex items-start gap-2">
          <MaterialIcon icon="info" className="w-4 h-4 text-on-primary-container mt-0.5" />
          <p className="text-sm text-on-primary-container">{rationale.reason}</p>
        </div>
      </div>
    </div>
  );
}
