import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface NumberInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  step,
  value = '',
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);

  const extraKeys = step.keyboard?.extraKeys || [];
  const hasExtraKeys = extraKeys.length > 0;

  // 数字键盘布局
  const keys = [
    ['7', '8', '9', '.', '←'],
    ['4', '5', '6', '√', 'π'],
    ['1', '2', '3', '÷', '×'],
    ['0', '+/-', '.', '-', '+'],
  ];

  const handleKeyPress = (key: string) => {
    if (disabled) return;

    switch (key) {
      case '←':
        onChange(value.slice(0, -1));
        break;
      case '清除':
        onChange('');
        break;
      case '提交':
        onSubmit();
        break;
      case '+/-':
        if (value.startsWith('-')) {
          onChange(value.slice(1));
        } else if (value) {
          onChange('-' + value);
        }
        break;
      default:
        onChange(value + key);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 输入框 */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.ui.inputPlaceholder || '输入答案'}
          disabled={disabled}
          className={cn(
            'w-48 px-4 py-3 text-center text-2xl font-mono',
            'border-2 border-gray-300 rounded-xl',
            'focus:border-blue-500 focus:outline-none',
            'disabled:bg-gray-100 disabled:cursor-not-allowed'
          )}
          onFocus={() => setShowKeypad(true)}
        />
        <button
          onClick={() => setShowKeypad(!showKeypad)}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'text-gray-400 hover:text-gray-600'
          )}
        >
          🔢
        </button>
      </div>

      {/* 数字键盘 */}
      {showKeypad && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-100 p-2 rounded-xl"
        >
          <div className="grid grid-cols-5 gap-1">
            {keys.flat().map((key, index) => (
              <button
                key={index}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                className={cn(
                  'px-3 py-3 rounded-lg font-medium',
                  'bg-white hover:bg-gray-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  key === '←' && 'text-red-500',
                  key === '提交' && 'col-span-2 bg-green-500 text-white hover:bg-green-600'
                )}
              >
                {key}
              </button>
            ))}
            {/* 额外按键 */}
            {extraKeys.map((key, index) => (
              <button
                key={`extra-${index}`}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                className="px-3 py-3 rounded-lg font-medium bg-blue-100 text-blue-700"
              >
                {key}
              </button>
            ))}
            {/* 提交按钮 */}
            <button
              onClick={() => handleKeyPress('提交')}
              disabled={disabled || !value}
              className={cn(
                'col-span-2 px-3 py-3 rounded-lg font-medium',
                'bg-green-500 text-white hover:bg-green-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              提交
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
