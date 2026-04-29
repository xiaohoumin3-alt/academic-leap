import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface YesNoInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const YesNoInput: React.FC<YesNoInputProps> = ({
  step,
  value,
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const yesText = step.options?.yes || '是';
  const noText = step.options?.no || '否';

  const handleYesClick = () => {
    onChange('yes');
    setTimeout(() => onSubmit(), 150);
  };

  const handleNoClick = () => {
    onChange('no');
    setTimeout(() => onSubmit(), 150);
  };

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleYesClick}
        disabled={disabled}
        className={cn(
          'px-8 py-4 rounded-xl font-medium text-lg transition-all',
          'bg-green-500 hover:bg-green-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {yesText}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleNoClick}
        disabled={disabled}
        className={cn(
          'px-8 py-4 rounded-xl font-medium text-lg transition-all',
          'bg-red-500 hover:bg-red-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {noText}
      </motion.button>
    </div>
  );
};
