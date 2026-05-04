'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from '../MaterialIcon';
import { cn } from '@/lib/utils';

interface ComplexityStats {
  totalQuestions: number;
  questionsWithFeatures: number;
  coverage: string;
  averages: {
    complexity: number;
    cognitiveLoad: number;
    reasoningDepth: number;
  };
  distribution: {
    low: number;
    medium: number;
    high: number;
  };
  questions?: Array<{
    id: string;
    complexity: number;
    cognitiveLoad: number;
    reasoningDepth: number;
  }>;
}

interface ComplexityAnalysisTabProps {
  stats: ComplexityStats | null;
}

const ComplexityAnalysisTab: React.FC<ComplexityAnalysisTabProps> = ({ stats }) => {
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MaterialIcon icon="hourglass_empty" className="text-tertiary animate-spin" />
          <p className="text-sm text-on-surface-variant mt-2">加载复杂度数据...</p>
        </div>
      </div>
    );
  }

  const total = stats.distribution.low + stats.distribution.medium + stats.distribution.high;
  const lowPercent = total > 0 ? Math.round(stats.distribution.low / total * 100) : 0;
  const mediumPercent = total > 0 ? Math.round(stats.distribution.medium / total * 100) : 0;
  const highPercent = total > 0 ? Math.round(stats.distribution.high / total * 100) : 0;

  const levelLabels = {
    low: '简单',
    medium: '中等',
    high: '复杂'
  };

  const levelColors = {
    low: 'text-success',
    medium: 'text-warning',
    high: 'text-error'
  };

  return (
    <div className="space-y-6">
      {/* 复杂度分布 */}
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center gap-3 mb-6">
          <MaterialIcon icon="bar_chart" className="text-primary" />
          <h3 className="text-lg font-display font-bold text-on-surface">题目复杂度分布</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { level: 'low' as const, count: stats.distribution.low, percent: lowPercent },
            { level: 'medium' as const, count: stats.distribution.medium, percent: mediumPercent },
            { level: 'high' as const, count: stats.distribution.high, percent: highPercent }
          ].map(({ level, count, percent }) => (
            <motion.button
              key={level}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedLevel(selectedLevel === level ? 'all' : level)}
              className={cn(
                "relative overflow-hidden rounded-2xl p-4 text-left transition-all",
                selectedLevel === level || selectedLevel === 'all'
                  ? "bg-primary-container/40 ring-2 ring-primary"
                  : "bg-surface-container hover:bg-surface-container-high"
              )}
            >
              <div className="text-xs text-on-surface-variant mb-1">
                {levelLabels[level]}
              </div>
              <div className={cn(
                "text-2xl font-display font-black",
                levelColors[level]
              )}>
                {count}
              </div>
              <div className="text-sm text-on-surface-variant">
                {percent}%
              </div>
            </motion.button>
          ))}
        </div>

        {/* 平均指标 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-high rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="show_chart" className="text-tertiary text-sm" />
              <span className="text-xs text-on-surface-variant">综合复杂度</span>
            </div>
            <div className="text-lg font-bold text-on-surface">
              {Math.round(stats.averages.complexity * 100)}%
            </div>
          </div>

          <div className="bg-surface-container-high rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="psychology" className="text-primary text-sm" />
              <span className="text-xs text-on-surface-variant">认知负荷</span>
            </div>
            <div className="text-lg font-bold text-on-surface">
              {Math.round(stats.averages.cognitiveLoad * 100)}%
            </div>
          </div>

          <div className="bg-surface-container-high rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MaterialIcon icon="device_hub" className="text-tertiary text-sm" />
              <span className="text-xs text-on-surface-variant">推理深度</span>
            </div>
            <div className="text-lg font-bold text-on-surface">
              {Math.round(stats.averages.reasoningDepth * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* 覆盖率 */}
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MaterialIcon icon="check_circle" className="text-success" />
            <div>
              <h4 className="text-sm font-bold text-on-surface">特征提取覆盖率</h4>
              <p className="text-xs text-on-surface-variant">
                {stats.questionsWithFeatures} / {stats.totalQuestions} 道题
              </p>
            </div>
          </div>
          <div className="text-3xl font-display font-black text-primary">
            {stats.coverage}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplexityAnalysisTab;
export { ComplexityAnalysisTab };
