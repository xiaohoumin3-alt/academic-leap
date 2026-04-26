/**
 * PredictionBadge - 显示答题预测概率
 *
 * 基于 Prediction Service 的 IRT 模型预测
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import MaterialIcon from './MaterialIcon';

interface PredictionBadgeProps {
  studentId?: string;
  questionDifficulty: number;
  knowledgeNodes: string[];
  className?: string;
}

interface PredictionResult {
  probability: number;
  confidence: number;
}

/**
 * 获取预测概率
 */
async function fetchPrediction(
  studentId: string,
  difficulty: number,
  knowledgeNodes: string[]
): Promise<PredictionResult | null> {
  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        questionFeatures: {
          difficulty,
          knowledgeNodes
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.predictions?.[0]) {
      return {
        probability: data.predictions[0].probability,
        confidence: data.predictions[0].confidence
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 获取难度标签
 */
function getDifficultyLabel(difficulty: number): string {
  if (difficulty <= 0.3) return '简单';
  if (difficulty <= 0.6) return '中等';
  return '困难';
}

/**
 * 获取概率颜色
 */
function getProbabilityColor(probability: number): string {
  if (probability >= 0.7) return 'text-green-600';
  if (probability >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * 获取概率图标
 */
function getProbabilityIcon(probability: number): string {
  if (probability >= 0.7) return 'sentiment_satisfied';
  if (probability >= 0.4) return 'sentiment_neutral';
  return 'sentiment_dissatisfied';
}

/**
 * PredictionBadge 组件
 */
const PredictionBadge: React.FC<PredictionBadgeProps> = ({
  studentId = 'guest',
  questionDifficulty,
  knowledgeNodes,
  className = ''
}) => {
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const loadPrediction = useCallback(async () => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const result = await fetchPrediction(studentId, questionDifficulty, knowledgeNodes);
      setPrediction(result);
    } catch {
      // 请求被取消或出错
    } finally {
      setIsLoading(false);
    }
  }, [studentId, questionDifficulty, knowledgeNodes]);

  useEffect(() => {
    // 防抖 300ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadPrediction();
    }, 300);

    // 清理
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadPrediction]);

  // 难度标签颜色
  const difficultyColor = questionDifficulty <= 0.3
    ? 'bg-green-100 text-green-700'
    : questionDifficulty <= 0.6
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-700';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* 难度标签 */}
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColor}`}>
        {getDifficultyLabel(questionDifficulty)}
      </div>

      {/* 预测概率 */}
      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-on-surface-variant">预测中...</span>
        </div>
      ) : prediction ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full">
          <MaterialIcon
            icon={getProbabilityIcon(prediction.probability)}
            className={getProbabilityColor(prediction.probability)}
            style={{ fontSize: '18px' }}
          />
          <span className={`text-sm font-bold ${getProbabilityColor(prediction.probability)}`}>
            {Math.round(prediction.probability * 100)}% 预测
          </span>
          {prediction.confidence < 0.5 && (
            <span className="text-xs text-on-surface-variant">(数据不足)</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full opacity-50">
          <MaterialIcon icon="help_outline" className="text-on-surface-variant" style={{ fontSize: '16px' }} />
          <span className="text-xs text-on-surface-variant">无预测数据</span>
        </div>
      )}
    </div>
  );
};

export default PredictionBadge;
export { fetchPrediction };
