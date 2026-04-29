/**
 * v2 协议 - 数字输入组件
 * 用于需要精确数字输入的题目
 * 注意：键盘由 ExercisePage 共享键盘提供，此组件只负责输入框
 */

import { cn } from '@/lib/utils';

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  status?: 'correct' | 'error' | null;
}

export function NumberInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '输入数字',
  className,
  status,
}: NumberInputProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSubmit();
        }
      }}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        'w-64 px-6 py-4 text-center text-2xl font-bold rounded-2xl border-2 transition-all',
        !status && 'bg-surface border-surface-variant text-on-surface',
        status === 'correct' && 'bg-primary-container border-primary text-on-primary-container',
        status === 'error' && 'bg-error-container border-error text-on-error-container',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    />
  );
}
