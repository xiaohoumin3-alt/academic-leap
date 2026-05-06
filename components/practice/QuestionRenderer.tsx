'use client';

import { cn } from '@/lib/utils';

export interface QuestionData {
  id: string;
  type: 'fill_blank' | 'multiple_choice' | 'short_answer';
  question: string;
  answer: string | string[];
  options?: string[];
  explanation?: string;
}

interface QuestionRendererProps {
  question: QuestionData;
  userAnswer?: string | string[];
  showResult?: boolean;
  onAnswerChange?: (answer: string) => void;
  disabled?: boolean;
}

/**
 * 题目类型标签映射
 */
const questionTypeLabels: Record<QuestionData['type'], string> = {
  fill_blank: '填空题',
  multiple_choice: '选择题',
  short_answer: '简答题',
};

/**
 * 题目渲染器
 * 根据题目类型渲染不同的答题界面
 */
export function QuestionRenderer({
  question,
  userAnswer = '',
  showResult = false,
  onAnswerChange,
  disabled = false,
}: QuestionRendererProps) {
  const { type, question: questionText, options, answer } = question;

  // 检查答案是否正确
  const isCorrect = (selectedOption: string): boolean | null => {
    if (!showResult) return null;
    const correctAnswer = Array.isArray(answer) ? answer[0] : answer;
    return selectedOption.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  // 渲染填空题
  const renderFillBlank = () => {
    // 简单处理：直接在题目中显示输入框占位
    return (
      <div className="space-y-4">
        <div className="text-lg leading-relaxed text-on-surface">
          {questionText.split(/_{3,}/).map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <input
                  type="text"
                  value={typeof userAnswer === 'string' ? userAnswer.split('|||')[i] || '' : ''}
                  onChange={(e) => {
                    if (typeof userAnswer === 'string' && onAnswerChange) {
                      const parts = userAnswer.split('|||');
                      parts[i] = e.target.value;
                      onAnswerChange(parts.join('|||'));
                    }
                  }}
                  disabled={disabled}
                  className={cn(
                    'mx-2 px-3 py-1.5 rounded-xl border-2 text-center min-w-[100px]',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30',
                    !showResult && 'border-outline hover:border-primary focus:border-primary bg-surface-container-low',
                    showResult && isCorrect(typeof userAnswer === 'string' ? userAnswer.split('|||')[i] || '' : '') === true && 'border-success bg-success-container/20 text-success',
                    showResult && isCorrect(typeof userAnswer === 'string' ? userAnswer.split('|||')[i] || '' : '') === false && 'border-error bg-error-container/20 text-error'
                  )}
                  placeholder="答案"
                />
              )}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // 渲染选择题
  const renderMultipleChoice = () => {
    return (
      <div className="space-y-3">
        {options?.map((option, i) => {
          const optionLetter = String.fromCharCode(65 + i); // A, B, C, D
          const correct = isCorrect(option);
          const isSelected = typeof userAnswer === 'string' && userAnswer === option;

          return (
            <button
              key={i}
              onClick={() => !disabled && onAnswerChange?.(option)}
              disabled={disabled}
              className={cn(
                'w-full p-4 rounded-2xl border-2 text-left transition-all',
                'flex items-center gap-3',
                // 基础样式
                'border-outline bg-surface-container-low hover:bg-surface-container hover:border-primary',
                // 选中状态
                isSelected && !showResult && 'border-primary bg-primary-container/30',
                // 结果状态
                showResult && correct === true && 'border-success bg-success-container/20',
                showResult && isSelected && correct === false && 'border-error bg-error-container/20',
                showResult && !isSelected && !correct && 'border-outline opacity-50'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm',
                'bg-surface-container-high text-on-surface-variant',
                isSelected && !showResult && 'bg-primary text-white',
                showResult && correct === true && 'bg-success text-white',
                showResult && isSelected && correct === false && 'bg-error text-white'
              )}>
                {optionLetter}
              </div>
              <span className="flex-1 text-on-surface">{option}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // 渲染简答题
  const renderShortAnswer = () => {
    return (
      <div className="space-y-3">
        <textarea
          value={typeof userAnswer === 'string' ? userAnswer : ''}
          onChange={(e) => onAnswerChange?.(e.target.value)}
          disabled={disabled}
          placeholder="请输入你的答案..."
          className={cn(
            'w-full p-4 rounded-2xl border-2 text-on-surface resize-none min-h-[120px]',
            'focus:outline-none focus:ring-2 focus:ring-primary/30',
            'border-outline bg-surface-container-low hover:bg-surface-container hover:border-primary',
            'focus:border-primary'
          )}
        />
        {showResult && (
          <div className="p-4 bg-surface-container rounded-2xl border border-outline/30">
            <div className="text-xs text-on-surface-variant uppercase font-bold mb-2">参考答案</div>
            <div className="text-on-surface">{Array.isArray(answer) ? answer[0] : answer}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 题目类型标签 */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'px-3 py-1 rounded-full text-xs font-medium',
          'bg-secondary-container text-on-secondary-container'
        )}>
          {questionTypeLabels[type]}
        </span>
      </div>

      {/* 题目内容 */}
      <p className="text-xl leading-relaxed text-on-surface font-medium">
        {questionText}
      </p>

      {/* 答题区域 */}
      <div className="p-4 bg-surface-container-low rounded-2xl">
        {type === 'fill_blank' && renderFillBlank()}
        {type === 'multiple_choice' && renderMultipleChoice()}
        {type === 'short_answer' && renderShortAnswer()}
      </div>
    </div>
  );
}
