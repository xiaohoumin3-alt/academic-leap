/**
 * ComplexityBadge - 显示题目复杂度特征
 *
 * 基于 QIE (Question Intelligence Engine) 提取的特征
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ComplexityFeatures {
  cognitiveLoad?: number;
  reasoningDepth?: number;
  complexity?: number;
}

interface ComplexityBadgeProps {
  features: ComplexityFeatures;
  className?: string;
  compact?: boolean;
}

/**
 * 获取复杂度标签
 */
function getComplexityLabel(value: number): string {
  if (value <= 0.3) return '简单';
  if (value <= 0.6) return '中等';
  return '困难';
}

/**
 * 获取复杂度颜色
 */
function getComplexityColor(value: number): { bg: string; text: string; border: string } {
  if (value <= 0.3) {
    return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  }
  if (value <= 0.6) {
    return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' };
  }
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
}

/**
 * ComplexityBadge 组件
 */
const ComplexityBadge: React.FC<ComplexityBadgeProps> = ({
  features,
  className = '',
  compact = false
}) => {
  const { cognitiveLoad, reasoningDepth, complexity } = features;

  // 如果没有任何特征，不显示
  if (cognitiveLoad === undefined && reasoningDepth === undefined && complexity === undefined) {
    return null;
  }

  // 紧凑模式：只显示综合复杂度
  if (compact && complexity !== undefined) {
    const colors = getComplexityColor(complexity);
    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border', colors.bg, colors.text, colors.border, className)}>
        <span className="text-xs font-medium">复杂度</span>
        <span className="text-sm font-bold">{complexity.toFixed(2)}</span>
        <span className="text-xs">{getComplexityLabel(complexity)}</span>
      </div>
    );
  }

  // 完整模式：显示所有特征
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* 认知负荷 */}
      {cognitiveLoad !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
          <span className="font-medium">认知</span>
          <span className="font-bold">{cognitiveLoad.toFixed(2)}</span>
        </div>
      )}

      {/* 推理深度 */}
      {reasoningDepth !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
          <span className="font-medium">推理</span>
          <span className="font-bold">{reasoningDepth.toFixed(2)}</span>
        </div>
      )}

      {/* 综合复杂度 */}
      {complexity !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
          <span className="font-medium">综合</span>
          <span className="font-bold">{complexity.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * ComplexityBar 组件 - 可视化复杂度条
 */
interface ComplexityBarProps {
  value: number;
  label: string;
  color: string;
}

export const ComplexityBar: React.FC<ComplexityBarProps> = ({ value, label, color }) => {
  const percentage = Math.max(0, Math.min(100, value * 100));

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-12">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-10 text-right">{value.toFixed(2)}</span>
    </div>
  );
};

export default ComplexityBadge;
