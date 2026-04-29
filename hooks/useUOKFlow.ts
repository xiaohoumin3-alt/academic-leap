/**
 * useUOKFlow - Complete UOK recommendation + learning + feedback hook
 */

import { useState, useCallback, useRef } from 'react';
import type { UOKStatsEntry } from '@/components/practice/UOKCumulativeStats';

export interface UOKRecommendation {
  questionId: string;
  questionData: {
    id: string;
    content: any;
    difficulty: number;
    knowledgePoints: string[];
    cognitiveLoad: number | null;
    reasoningDepth: number | null;
    complexity: number | null;
  };
  rationale: {
    currentMastery: number;
    targetComplexity: number;
    complexityGap: number;
    reason: string;
  };
  beforeProbability: number;
}

export interface UOKFeedback {
  beforeProbability: number;
  randomProbability: number;
  masteryBefore: number;
  masteryAfter: number;
  nextTargetComplexity: number;
  isCorrect: boolean;
  topic: string;
}

export interface UOKFlowState {
  // Loading states
  isLoadingQuestion: boolean;
  isSubmittingAnswer: boolean;

  // Current question data
  currentRecommendation: UOKRecommendation | null;

  // Latest feedback
  latestFeedback: UOKFeedback | null;

  // Error state
  error: string | null;

  // Statistics
  totalAnswered: number;
  correctCount: number;

  // NEW: History for cumulative stats
  history: UOKStatsEntry[];
}

export function useUOKFlow() {
  const [state, setState] = useState<UOKFlowState>({
    isLoadingQuestion: false,
    isSubmittingAnswer: false,
    currentRecommendation: null,
    latestFeedback: null,
    error: null,
    totalAnswered: 0,
    correctCount: 0,
    history: [],
  });

  const excludeIdsRef = useRef<string[]>([]);

  /**
   * Get next recommended question
   */
  const getNextQuestion = useCallback(async () => {
    setState(prev => ({ ...prev, isLoadingQuestion: true, error: null }));

    try {
      const params = new URLSearchParams();
      if (excludeIdsRef.current.length > 0) {
        params.set('exclude', excludeIdsRef.current.join(','));
      }

      const res = await fetch(`/api/uok/recommend?${params.toString()}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '获取题目失败');
      }

      const data = await res.json();

      // Add to exclude list
      excludeIdsRef.current.push(data.questionId);

      setState(prev => ({
        ...prev,
        isLoadingQuestion: false,
        currentRecommendation: data,
        latestFeedback: null, // Clear previous feedback
      }));

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setState(prev => ({
        ...prev,
        isLoadingQuestion: false,
        error: message,
      }));
      return null;
    }
  }, []);

  /**
   * Submit answer and get feedback
   */
  const submitAnswer = useCallback(async (questionId: string, isCorrect: boolean) => {
    setState(prev => ({ ...prev, isSubmittingAnswer: true, error: null }));

    try {
      const res = await fetch('/api/uok/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, isCorrect }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '提交答案失败');
      }

      const data = await res.json();

      // Add to history for cumulative stats
      const historyEntry: UOKStatsEntry = {
        uokProbability: data.feedback.beforeProbability,
        randomProbability: data.feedback.randomProbability,
        isCorrect,
      };

      setState(prev => ({
        ...prev,
        isSubmittingAnswer: false,
        latestFeedback: data.feedback,
        totalAnswered: prev.totalAnswered + 1,
        correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
        history: [...prev.history, historyEntry],
      }));

      return data.feedback;
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setState(prev => ({
        ...prev,
        isSubmittingAnswer: false,
        error: message,
      }));
      return null;
    }
  }, []);

  /**
   * Reset the flow (clear state and exclude list)
   */
  const reset = useCallback(() => {
    excludeIdsRef.current = [];
    setState({
      isLoadingQuestion: false,
      isSubmittingAnswer: false,
      currentRecommendation: null,
      latestFeedback: null,
      error: null,
      totalAnswered: 0,
      correctCount: 0,
      history: [],
    });
  }, []);

  /**
   * Get accuracy rate
   */
  const accuracy = state.totalAnswered > 0
    ? state.correctCount / state.totalAnswered
    : 0;

  return {
    // State
    state,

    // Computed
    isLoading: state.isLoadingQuestion || state.isSubmittingAnswer,
    accuracy,

    // Actions
    getNextQuestion,
    submitAnswer,
    reset,

    // Convenience getters
    currentQuestion: state.currentRecommendation?.questionData ?? null,
    currentRationale: state.currentRecommendation?.rationale ?? null,
    beforeProbability: state.currentRecommendation?.beforeProbability ?? 0.5,
    latestFeedback: state.latestFeedback,
    history: state.history, // NEW: expose history for cumulative stats
  };
}
