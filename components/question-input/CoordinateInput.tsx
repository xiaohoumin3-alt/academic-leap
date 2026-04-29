import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface CoordinateInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const CoordinateInput: React.FC<CoordinateInputProps> = ({
  step,
  value = '',
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const [xValue, setXValue] = useState('');
  const [yValue, setYValue] = useState('');

  // 从现有值解析
  React.useEffect(() => {
    const match = value.match(/^\(?\s*([-\d.]+)\s*[,，]\s*([-\d.]+)\s*\)?$/);
    if (match) {
      setXValue(match[1]);
      setYValue(match[2]);
    }
  }, [value]);

  const handleXChange = (newX: string) => {
    setXValue(newX);
    if (yValue) {
      onChange(`(${newX}, ${yValue})`);
    }
  };

  const handleYChange = (newY: string) => {
    setYValue(newY);
    if (xValue) {
      onChange(`(${xValue}, ${newY})`);
    }
  };

  const handleSubmit = () => {
    if (xValue && yValue) {
      onChange(`(${xValue}, ${yValue})`);
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-600">x</label>
          <input
            type="text"
            value={xValue}
            onChange={(e) => handleXChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 text-center text-lg font-mono',
              'border-2 border-gray-300 rounded-lg',
              'focus:border-blue-500 focus:outline-none',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <span className="text-2xl text-gray-400">,</span>

        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-600">y</label>
          <input
            type="text"
            value={yValue}
            onChange={(e) => handleYChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 text-center text-lg font-mono',
              'border-2 border-gray-300 rounded-lg',
              'focus:border-blue-500 focus:outline-none',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={disabled || !xValue || !yValue}
          className={cn(
            'ml-4 px-6 py-3 rounded-xl font-medium',
            'bg-green-500 text-white hover:bg-green-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          提交
        </motion.button>
      </div>

      <p className="text-sm text-gray-500">
        坐标格式： (x, y)
      </p>
    </div>
  );
};
