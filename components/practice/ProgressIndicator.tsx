'use client';

import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  progress: number; // 0-100
  mode?: 'bar' | 'dots';
  showLabel?: boolean;
  variant?: 'primary' | 'secondary';
}

export function ProgressIndicator({
  current,
  total,
  progress,
  mode = 'bar',
  showLabel = true,
  variant = 'primary',
}: ProgressIndicatorProps) {
  if (mode === 'dots') {
    return (
      <div className="space-y-2">
        {showLabel && (
          <div className="flex items-center justify-between text-sm text-on-surface-variant">
            <span>答题进度</span>
            <span>{current + 1}/{total}</span>
          </div>
        )}
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-2 rounded-full transition-all duration-300',
                i < current && variant === 'primary' && 'bg-primary',
                i === current && variant === 'primary' && 'bg-primary animate-pulse',
                i > current && 'bg-surface-container-highest',
                i < current && variant === 'secondary' && 'bg-secondary',
                i === current && variant === 'secondary' && 'bg-secondary animate-pulse',
                i > current && variant === 'secondary' && 'bg-surface-container-highest'
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showLabel && (
        <div className="flex items-center justify-between text-sm text-on-surface-variant">
          <span>学习进度</span>
          <span>{current + 1}/{total} · {Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variant === 'primary' && 'bg-primary',
            variant === 'secondary' && 'bg-secondary'
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
