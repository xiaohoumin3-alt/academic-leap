'use client';

import React from 'react';
import { motion } from 'motion/react';
import MaterialIcon from '../MaterialIcon';
import { cn } from '@/lib/utils';

interface ComplexityStats {
  totalQuestions: number;
  questionsWithFeatures: number;
  coverage: string;
  averages: {
    complexity: string;
    cognitiveLoad: string;
    reasoningDepth: string;
  };
  distribution: {
    low: number;
    medium: number;
    high: number;
  };
}

interface ComplexityOverviewProps {
  stats: ComplexityStats | null;
  onExplore?: () => void;
}

const ComplexityOverview: React.FC<ComplexityOverviewProps> = ({ stats, onExplore }) => {
  if (!stats) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center gap-3 mb-3">
          <MaterialIcon icon="analytics" className="text-primary" style={{ fontSize: '20px' }} />
          <h4 className="text-sm font-bold text-on-surface-variant">题目复杂度分析</h4>
        </div>
        <p className="text-sm text-on-surface-variant">加载中...</p>
      </div>
    );
  }

  const total = stats.distribution.low + stats.distribution.medium + stats.distribution.high;
  const lowPercent = total > 0 ? (stats.distribution.low / total * 100) : 0;
  const mediumPercent = total > 0 ? (stats.distribution.medium / total * 100) : 0;
  const highPercent = total > 0 ? (stats.distribution.high / total * 100) : 0;

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MaterialIcon icon="analytics" className="text-primary" style={{ fontSize: '20px' }} />
          <h4 className="text-sm font-bold text-on-surface">题目复杂度分析</h4>
        </div>
        {onExplore && (
          <button
            onClick={onExplore}
            className="text-xs px-3 py-1 bg-primary-container text-on-primary-container rounded-full font-medium"
          >
            查看详情
          </button>
        )}
      </div>

      {/* 覆盖率 */}
      <div className="flex items-center justify-between mb-4 p-3 bg-surface-container rounded-xl">
        <span className="text-sm text-on-surface-variant">特征覆盖率</span>
        <span className={cn(
          "text-lg font-display font-black",
          parseFloat(stats.coverage) > 50 ? "text-success" : "text-warning"
        )}>
          {stats.coverage}
        </span>
      </div>

      {/* 平均特征值 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <div className="text-xs text-blue-600 mb-1">认知负荷</div>
          <div className="text-lg font-bold text-blue-700">{stats.averages.cognitiveLoad}</div>
        </div>
        <div className="text-center p-2 bg-purple-50 rounded-lg">
          <div className="text-xs text-purple-600 mb-1">推理深度</div>
          <div className="text-lg font-bold text-purple-700">{stats.averages.reasoningDepth}</div>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <div className="text-xs text-orange-600 mb-1">综合复杂度</div>
          <div className="text-lg font-bold text-orange-700">{stats.averages.complexity}</div>
        </div>
      </div>

      {/* 分布图 */}
      <div className="mb-3">
        <div className="text-xs text-on-surface-variant mb-2">复杂度分布</div>
        <div className="flex h-8 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${lowPercent}%` }}
            transition={{ duration: 0.8 }}
            className="bg-green-500 flex items-center justify-center"
          >
            {lowPercent > 10 && <span className="text-xs text-white font-medium">{lowPercent.toFixed(0)}%</span>}
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${mediumPercent}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="bg-yellow-500 flex items-center justify-center"
          >
            {mediumPercent > 10 && <span className="text-xs text-white font-medium">{mediumPercent.toFixed(0)}%</span>}
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${highPercent}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-red-500 flex items-center justify-center"
          >
            {highPercent > 10 && <span className="text-xs text-white font-medium">{highPercent.toFixed(0)}%</span>}
          </motion.div>
        </div>
      </div>

      {/* 分布标签 */}
      <div className="flex justify-between text-xs">
        <span className="text-green-600">低 {stats.distribution.low}</span>
        <span className="text-yellow-600">中 {stats.distribution.medium}</span>
        <span className="text-red-600">高 {stats.distribution.high}</span>
      </div>
    </div>
  );
};

export default ComplexityOverview;
