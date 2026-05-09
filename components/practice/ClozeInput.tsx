'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ClozeInputProps {
  question: string;
  answers: string[];
  showResult?: boolean;
  userAnswers?: string[];
  onAnswerChange?: (index: number, value: string) => void;
  disabled?: boolean;
}

/**
 * 填空题输入组件
 * 将题目中的 ____ 替换为输入框
 */
export function ClozeInput({
  question,
  answers,
  showResult = false,
  userAnswers = [],
  onAnswerChange,
  disabled = false
}: ClozeInputProps) {
  // 解析题目，将 ____ 替换为输入框
  const parseQuestion = () => {
    const parts: Array<{ type: 'text' | 'input'; content: string; index?: number }> = [];
    let lastIndex = 0;
    let inputIndex = 0;

    // 匹配连续的下划线（3个或更多）
    const regex = /_{3,}/g;
    let match;

    while ((match = regex.exec(question)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: question.slice(lastIndex, match.index)
        });
      }

      // 添加输入框
      parts.push({
        type: 'input',
        content: '',
        index: inputIndex++
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < question.length) {
      parts.push({
        type: 'text',
        content: question.slice(lastIndex)
      });
    }

    return parts;
  };

  const parts = parseQuestion();

  // 检查答案是否正确（忽略大小写和空格）
  const isCorrect = (index: number): boolean | null => {
    if (!showResult || !userAnswers[index]) return null;
    const userAnswer = userAnswers[index]?.toLowerCase().trim();
    const correctAnswer = answers[index]?.toLowerCase().trim();
    if (!correctAnswer) return null;
    return userAnswer === correctAnswer;
  };

  return (
    <div className="space-y-4">
      {/* 题目 + 输入框 */}
      <div className="text-lg leading-relaxed text-on-surface flex flex-wrap gap-x-2 gap-y-3 items-baseline">
        {parts.map((part, i) => {
          if (part.type === 'text') {
            return (
              <span key={`text-${i}`} className="whitespace-pre-wrap">
                {part.content}
              </span>
            );
          }

          const inputIndex = part.index!;
          const correct = isCorrect(inputIndex);

          return (
            <input
              key={`input-${inputIndex}`}
              type="text"
              value={userAnswers[inputIndex] || ''}
              onChange={(e) => onAnswerChange?.(inputIndex, e.target.value)}
              disabled={disabled}
              className={cn(
                'px-3 py-1.5 rounded-xl border-2 text-center transition-all min-w-[100px]',
                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                // 基础样式
                'bg-surface-container-low text-on-surface font-medium',
                // 未显示结果时
                !showResult && 'border-outline hover:border-primary focus:border-primary',
                // 显示结果后
                showResult && correct === true && 'border-success bg-success-container/20 text-success',
                showResult && correct === false && 'border-error bg-error-container/20 text-error',
                showResult && correct === null && 'border-outline text-on-surface-variant'
              )}
              placeholder="答案"
            />
          );
        })}
      </div>

      {/* 显示正确答案（提交后） */}
      {showResult && (
        <div className="p-4 bg-surface-container-low rounded-2xl border border-outline/30">
          <div className="text-xs text-on-surface-variant uppercase font-bold mb-2">正确答案</div>
          <div className="text-sm text-on-surface flex flex-wrap gap-2">
            {answers.map((answer, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-primary-container/30 rounded-lg text-primary font-medium"
              >
                {i + 1}. {answer}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 解析答案字符串为数组
 * 支持逗号、中文逗号、中文句号分隔的多个答案
 */
export function parseAnswers(answerString: string | undefined | null): string[] {
  if (!answerString) return [];
  return answerString
    .split(/[,，、]/)
    .map(a => a.trim())
    .filter(a => a.length > 0);
}
