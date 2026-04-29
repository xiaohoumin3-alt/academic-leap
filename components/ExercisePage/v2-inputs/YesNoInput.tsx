/**
 * v2 协议 - 是/否输入组件
 * 用于判断题
 */

import { cn } from '@/lib/utils';

interface YesNoInputProps {
  value?: string;
  onYes: () => void;
  onNo: () => void;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
  className?: string;
}

export function YesNoInput({
  value,
  onYes,
  onNo,
  disabled = false,
  yesLabel = '是',
  noLabel = '否',
  className,
}: YesNoInputProps) {
  const isSelected = (option: 'yes' | 'no') => value === option;

  return (
    <div className={cn('flex gap-4', className)}>
      <button
        type="button"
        onClick={onYes}
        disabled={disabled}
        className={cn(
          'flex-1 py-4 px-6 rounded-2xl font-bold text-lg transition-all',
          'border-2',
          isSelected('yes')
            ? 'bg-primary-container border-primary text-on-primary-container'
            : 'bg-surface border-surface-variant text-on-surface hover:bg-surface-container-highest',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={onNo}
        disabled={disabled}
        className={cn(
          'flex-1 py-4 px-6 rounded-2xl font-bold text-lg transition-all',
          'border-2',
          isSelected('no')
            ? 'bg-error-container border-error text-on-error-container'
            : 'bg-surface border-surface-variant text-on-surface hover:bg-surface-container-highest',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {noLabel}
      </button>
    </div>
  );
}
