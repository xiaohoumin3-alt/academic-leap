/**
 * v2 协议 - 选项输入组件
 * 用于选择题
 */

import { cn } from '@/lib/utils';

export interface ChoiceOption {
  value: string;
  label: string;
}

interface ChoiceInputProps {
  options: ChoiceOption[] | Record<string, string>;
  value?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  className?: string;
  status?: 'correct' | 'error' | null;
}

export function ChoiceInput({
  options,
  value,
  onSelect,
  disabled = false,
  className,
  status,
}: ChoiceInputProps) {
  // 转换选项格式
  const choiceOptions: ChoiceOption[] = Array.isArray(options)
    ? options
    : Object.entries(options).map(([key, label]) => ({ value: key, label }));

  return (
    <div className={cn('flex flex-col gap-3 w-full max-w-md', className)}>
      {choiceOptions.map((option) => {
        const isSelected = value === option.value;
        const isCorrect = status === 'correct' && isSelected;
        const isError = status === 'error' && isSelected;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            disabled={disabled}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium text-base transition-all',
              'border-2 text-left',
              isSelected
                ? isCorrect
                  ? 'bg-primary-container border-primary text-on-primary-container'
                  : isError
                    ? 'bg-error-container border-error text-on-error-container'
                    : 'bg-secondary-container border-secondary text-on-secondary-container'
                : 'bg-surface border-surface-variant text-on-surface hover:bg-surface-container-highest',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
