// lib/qie/types.ts

/**
 * QIE Shared Types
 */

/**
 * Context for prediction
 */
export interface Context {
  difficulty: number;
  complexity: number;
}

/**
 * Question features from Layer 1
 */
export interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
  difficulty: number;
}

/**
 * Model export format
 */
export interface ModelExport {
  students: [string, number[]][];
  questions: [string, number[]][];
  weights: {
    w1: number[];
    b1: number[];
    w2: number[];
    b2: number;
  };
}

/**
 * ML 内部状态（计算域）
 */
export interface MLState {
  embeddings: {
    students: Map<string, Float32Array>;
    questions: Map<string, Float32Array>;
  };
  weights: {
    w1: Float32Array;
    b1: Float32Array;
    w2: Float32Array;
    b2: number;
  };
  updateCounter: number;
  transfer: ComplexityTransferConfig;     // NEW: complexity transfer state
}

/**
 * Complexity transfer weights for feature space mapping
 * w = (w_cognitive, w_reasoning, w_complexity)
 */
export interface ComplexityTransferWeights {
  cognitiveLoad: number;    // w₁: cognitive load penalty weight
  reasoningDepth: number;   // w₂: reasoning depth penalty weight
  complexity: number;       // w₃: structural complexity penalty weight
}

/**
 * Complexity difference vector between two questions
 * ΔC = (ΔcognitiveLoad, ΔreasoningDepth, Δcomplexity)
 */
export interface ComplexityDelta {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}

/**
 * Configuration for complexity transfer mechanism
 */
export interface ComplexityTransferConfig {
  weights: ComplexityTransferWeights;     // Current weight vector
  gateThreshold: number;                  // τ: minimum P_simple for calibration
  learningRate: number;                   // η: weight update step size
}

export const DEFAULT_TRANSFER_CONFIG: ComplexityTransferConfig = {
  weights: {
    cognitiveLoad: 0.5,
    reasoningDepth: 0.3,
    complexity: 0.2,
  },
  gateThreshold: 0.7,
  learningRate: 0.01,
};

/**
 * UOK State types
 */
export interface QuestionState {
  id: string;
  topics: string[];
  features: QuestionFeatures;
  quality: number;
  attemptCount: number;
  correctCount: number;
}

export interface StudentState {
  id: string;
  knowledge: Map<string, number>;
  attemptCount: number;
  correctCount: number;
}

export interface UOKState {
  questions: Map<string, QuestionState>;
  students: Map<string, StudentState>;
  space: SpaceState;
  trace: TraceEntry[];
  _ml: MLState;  // NEW: ML internal computation domain
}

export class SpaceState {
  topics = new Set<string>();
  topicCounts = new Map<string, number>();

  update(topics: string[], _features: QuestionFeatures): void {
    for (const t of topics) {
      this.topics.add(t);
      this.topicCounts.set(t, (this.topicCounts.get(t) ?? 0) + 1);
    }
  }

  getCount(topic: string): number {
    return this.topicCounts.get(topic) ?? 0;
  }
}

export type TraceEntry =
  | { type: 'encode'; questionId: string; time: number }
  | { type: 'answer'; studentId: string; questionId: string; correct: boolean; time: number };

export type Explanation =
  | { type: 'student'; studentId: string; ability: number; weakTopics: { topic: string; mastery: number }[]; totalAttempts: number }
  | { type: 'question'; questionId: string; topics: string[]; quality: number; attempts: number; features: QuestionFeatures }
  | { type: 'system'; totalQuestions: number; totalStudents: number; totalAttempts: number; topics: string[]; traceLength: number }
  | { type: 'error'; message: string };

export type Action =
  | { type: 'recommend'; topic: string; reason: string }
  | { type: 'gap_report'; gaps: Gap[] }
  | { type: 'done'; reason: string }
  | { type: 'error'; reason: string };

export interface Gap {
  topic: string;
  mastery: number;
  type: 'weak_knowledge' | 'missing_questions';
  count?: number;
}
