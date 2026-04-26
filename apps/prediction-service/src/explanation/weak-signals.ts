/**
 * Weak Causal Signals Module
 *
 * Computes correlations and signals WITHOUT claiming causality.
 * All signals must include caveats about non-causality.
 */

export interface WeakCausalSignal {
  type: 'correlation' | 'conditional_independence';
  description: string;
  value: number;
  sampleSize: number;
  caveat: string;  // Must include "不承诺因果" (non-causality disclaimer)
}

export interface InterventionCorrelation {
  action: string;      // "学习知识点X"
  outcome: string;     // "X正确率提升"
  correlation: number;
  sampleSize: number;
}

export interface WeakSignalsResult {
  signals: WeakCausalSignal[];
  interventionCorrelations: InterventionCorrelation[];
  generatedAt: number;
}

export interface AnswerInput {
  correct: boolean;
  timestamp: number;
  knowledgeNodes: string[];
  timeSpent?: number;
}

export interface AbilityData {
  ability: number;
  sampleSize: number;
}

/**
 * Check if answers contain time data
 */
export function hasTimeData(answers: Array<{ timeSpent?: number }>): boolean {
  return answers.some(a => a.timeSpent !== undefined && a.timeSpent > 0);
}

/**
 * Compute Pearson correlation coefficient between time spent and correctness
 * Returns null if not enough data (< 10 samples)
 */
export function computeTimeCorrectnessCorrelation(
  answers: Array<{ correct: boolean; timeSpent: number }>
): number | null {
  const withTime = answers.filter(a => a.timeSpent !== undefined);
  if (withTime.length < 10) return null;

  // Pearson correlation coefficient
  const n = withTime.length;
  const sumX = withTime.reduce((s, a) => s + a.timeSpent!, 0);
  const sumY = withTime.reduce((s, a) => s + (a.correct ? 1 : 0), 0);
  const sumXY = withTime.reduce((s, a) => s + a.timeSpent! * (a.correct ? 1 : 0), 0);
  const sumX2 = withTime.reduce((s, a) => s + a.timeSpent! ** 2, 0);
  const sumY2 = withTime.reduce((s, a) => s + (a.correct ? 1 : 0) ** 2, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Compute correlation between knowledge node mastery and performance
 * Requires minimum sample size of 5 per node
 */
export function computeNodePerformanceCorrelation(
  abilities: Map<string, { ability: number; sampleSize: number }>
): InterventionCorrelation[] {
  const correlations: InterventionCorrelation[] = [];

  for (const [nodeId, data] of abilities) {
    if (data.sampleSize >= 5) {
      correlations.push({
        action: `掌握知识点 ${nodeId}`,
        outcome: `${nodeId} 相关题目正确率`,
        correlation: data.ability,
        sampleSize: data.sampleSize
      });
    }
  }

  return correlations;
}

/**
 * Main function to compute weak causal signals from answer data and abilities
 *
 * Computes:
 * - Time-correctness correlation (if time data exists)
 * - Knowledge node performance correlations (minimum 5 samples per node)
 *
 * All signals include non-causality disclaimers.
 */
export function computeWeakSignals(
  answers: Array<{ correct: boolean; timestamp: number; knowledgeNodes: string[]; timeSpent?: number }>,
  abilities: Map<string, { ability: number; sampleSize: number }>
): WeakSignalsResult {
  const signals: WeakCausalSignal[] = [];
  const interventionCorrelations: InterventionCorrelation[] = [];

  // Compute time-correctness correlation if time data exists
  if (hasTimeData(answers)) {
    const answersWithTime = answers.filter(
      (a): a is { correct: boolean; timestamp: number; knowledgeNodes: string[]; timeSpent: number } =>
        a.timeSpent !== undefined
    );
    const timeCorrelation = computeTimeCorrectnessCorrelation(answersWithTime);
    if (timeCorrelation !== null) {
      signals.push({
        type: 'correlation',
        description: '答题时间与正确率的相关性',
        value: timeCorrelation,
        sampleSize: answersWithTime.length,
        caveat: '仅显示相关性，不承诺因果关系'
      });
    }
  }

  // Compute knowledge node performance correlations
  const nodeCorrelations = computeNodePerformanceCorrelation(abilities);
  interventionCorrelations.push(...nodeCorrelations);

  return {
    signals,
    interventionCorrelations,
    generatedAt: Date.now()
  };
}
