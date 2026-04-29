import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { StepProtocolV2 } from '../../lib/question-engine/protocol-v2';

interface ChoiceInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const ChoiceInput: React.FC<ChoiceInputProps> = ({
  step,
  value,
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const choices = step.options?.choices || [];

  const isMultipleChoice = step.expectedAnswer.type === 'choice' &&
    Array.isArray(step.expectedAnswer.value);

  const handleChoiceClick = (choiceValue: string) => {
    if (disabled) return;

    let newValue: string;
    if (isMultipleChoice) {
      // 多选：切换选项
      const currentValues = value ? value.split(',') : [];
      if (currentValues.includes(choiceValue)) {
        newValue = currentValues.filter(v => v !== choiceValue).join(',');
      } else {
        newValue = [...currentValues, choiceValue].join(',');
      }
    } else {
      // 单选：直接设置
      newValue = choiceValue;
    }

    onChange(newValue);

    // 单选模式下自动提交
    if (!isMultipleChoice) {
      setTimeout(() => onSubmit(), 150);
    }
  };

  const isSelected = (choiceValue: string) => {
    if (!value) return false;
    if (isMultipleChoice) {
      return value.split(',').includes(choiceValue);
    }
    return value === choiceValue;
  };

  return (
    <div className="flex flex-col gap-3 py-4">
      {choices.map((choice) => (
        <motion.button
          key={choice.value}
          whileHover={{ scale: disabled ? 1 : 1.02 }}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          onClick={() => handleChoiceClick(choice.value)}
          disabled={disabled}
          className={cn(
            'w-full px-6 py-4 rounded-xl font-medium text-left',
            'transition-all border-2',
            isSelected(choice.value)
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {choice.label}
        </motion.button>
      ))}

      {/* 多选模式显示提交按钮 */}
      {isMultipleChoice && (
        <motion.button
          whileHover={{ scale: (disabled || !value) ? 1 : 1.02 }}
          whileTap={{ scale: (disabled || !value) ? 1 : 0.98 }}
          onClick={onSubmit}
          disabled={disabled || !value}
          className={cn(
            'mt-4 px-8 py-3 rounded-xl font-medium',
            'bg-green-500 text-white hover:bg-green-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          提交答案
        </motion.button>
      )}
    </div>
  );
};

export default ChoiceInput;
