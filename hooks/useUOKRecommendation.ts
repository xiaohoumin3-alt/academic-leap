/**
 * Hook for UOK-powered question recommendation
 */

import { useState, useCallback } from 'react';
import type { RecommendationRationale } from '@/lib/qie/types';

export interface QuestionWithComplexity {
  id: string;
  content: any;
  difficulty: number;
  knowledgePoints: string[];
  cognitiveLoad: number | null;
  reasoningDepth: number | null;
  complexity: number | null;
}

export interface UOKRecommendationResult {
  question: QuestionWithComplexity;
  rationale: RecommendationRationale;
}

export function useUOKRecommendation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextQuestion = useCallback(async (excludeIds?: string[]): Promise<UOKRecommendationResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (excludeIds && excludeIds.length > 0) {
        params.set('exclude', excludeIds.join(','));
      }

      const res = await fetch(`/api/practice/next-question?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '获取题目失败');
      }

      const data = await res.json();
      return {
        question: data.question,
        rationale: data.rationale,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const encodeAnswer = useCallback(async (questionId: string, correct: boolean): Promise<number | null> => {
    try {
      const res = await fetch('/api/practice/next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, correct }),
      });

      if (!res.ok) {
        console.error('Failed to encode answer:', await res.text());
        return null;
      }

      const data = await res.json();
      return data.probability;
    } catch (err) {
      console.error('Encode answer error:', err);
      return null;
    }
  }, []);

  return {
    getNextQuestion,
    encodeAnswer,
    isLoading,
    error,
  };
}
