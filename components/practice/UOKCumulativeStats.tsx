'use client';

import { cn } from '@/lib/utils';
import MaterialIcon from '../MaterialIcon';

export interface UOKStatsEntry {
  uokProbability: number;
  randomProbability: number;
  isCorrect: boolean;
}

interface UOKCumulativeStatsProps {
  history: UOKStatsEntry[];
  limit?: number;
  compact?: boolean;
}

export default function UOKCumulativeStats({
  history,
  limit = 20,
  compact = false,
}: UOKCumulativeStatsProps) {
  // Get last N entries
  const recentHistory = history.slice(-limit);

  // Calculate hit rates
  const uokHits = recentHistory.filter(e => e.isCorrect).length;
  const uokHitRate = recentHistory.length > 0 ? uokHits / recentHistory.length : 0;

  // Calculate what random's hit rate would be
  // Use threshold: if randomProbability >= 0.5, predict correct
  const randomHits = recentHistory.filter(e => {
    return e.randomProbability >= 0.5 ? e.isCorrect : !e.isCorrect;
  }).length;
  const randomHitRate = recentHistory.length > 0 ? randomHits / recentHistory.length : 0;

  const diff = uokHitRate - randomHitRate;
  const diffPercent = Math.round(diff * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-4 px-3 py-2 bg-surface-container-low rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface-variant">最近 {recentHistory.length} 题</span>
        </div>
        <div className="w-px h-3 bg-surface-container-highest" />
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface-variant">UOK:</span>
          <span className="font-bold text-primary">{Math.round(uokHitRate * 100)}%</span>
        </div>
        <div className="w-px h-3 bg-surface-container-highest" />
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface-variant">Random:</span>
          <span className="font-bold text-on-surface-variant">{Math.round(randomHitRate * 100)}%</span>
        </div>
        {diffPercent !== 0 && (
          <>
            <div className="w-px h-3 bg-surface-container-highest" />
            <div className={cn(
              "font-bold",
              diffPercent > 0 ? "text-success" : "text-error"
            )}>
              {diffPercent > 0 ? '+' : ''}{diffPercent}%
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-[1.5rem] p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon icon="insights" className="w-5 h-5 text-tertiary" />
        <div>
          <div className="text-sm font-bold text-on-surface">累计对比</div>
          <div className="text-xs text-on-surface-variant">最近 {recentHistory.length} 题</div>
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-3 gap-3">
        {/* UOK Hit Rate */}
        <div className="bg-primary-container/30 rounded-2xl p-4 text-center">
          <div className="text-xs text-on-surface-variant mb-1">UOK 命中率</div>
          <div className="text-3xl font-display font-black text-primary">
            {Math.round(uokHitRate * 100)}%
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {uokHits}/{recentHistory.length}
          </div>
        </div>

        {/* Random Hit Rate */}
        <div className="bg-surface-container-low rounded-2xl p-4 text-center">
          <div className="text-xs text-on-surface-variant mb-1">Random 命中率</div>
          <div className="text-3xl font-display font-black text-on-surface-variant">
            {Math.round(randomHitRate * 100)}%
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {randomHits}/{recentHistory.length}
          </div>
        </div>

        {/* Difference */}
        <div className={cn(
          "rounded-2xl p-4 text-center",
          diffPercent > 0
            ? "bg-success-container/30"
            : diffPercent < 0
            ? "bg-error-container/30"
            : "bg-surface-container-low"
        )}>
          <div className="text-xs text-on-surface-variant mb-1">差值</div>
          <div className={cn(
            "text-3xl font-display font-black",
            diffPercent > 0 ? "text-success" : diffPercent < 0 ? "text-error" : "text-on-surface-variant"
          )}>
            {diffPercent > 0 ? '+' : ''}{diffPercent}%
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {diffPercent > 10 ? '显著优于' : diffPercent > 0 ? '优于' : diffPercent < 0 ? '低于' : '持平'}
          </div>
        </div>
      </div>

      {/* Insight */}
      {diffPercent > 15 && (
        <div className="mt-4 px-4 py-3 bg-success-container/20 rounded-2xl">
          <div className="flex items-center gap-2 text-sm">
            <MaterialIcon icon="stars" className="w-4 h-4 text-success" />
            <span className="text-on-success-container/80">
              UOK 推荐显著优于随机选择，继续使用！
            </span>
          </div>
        </div>
      )}

      {diffPercent < -5 && (
        <div className="mt-4 px-4 py-3 bg-warning-container/20 rounded-2xl">
          <div className="flex items-center gap-2 text-sm">
            <MaterialIcon icon="info" className="w-4 h-4 text-on-warning-container" />
            <span className="text-on-warning-container/80">
              UOK 正在学习你的模式，数据积累后会越来越准确
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
