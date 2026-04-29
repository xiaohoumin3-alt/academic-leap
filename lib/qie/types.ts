// lib/qie/types.ts

/**
 * QIE Shared Types
 */

// ========== Phase 1: β 冲突解决 ==========

/**
 * 题目难度参数 - 明确区分三种 β
 *
 * - β_true: 题目固有难度（隐变量，不可观测）
 * - β_hat: IRT 估计的题目参数
 * - β_target: 生成器目标难度
 */
export interface QuestionDifficulty {
  // β_true: 不可观测的真实难度（理论值）
  beta_true?: number;

  // β_hat: IRT 估计值
  beta_hat?: number;
  beta_hat_se?: number;
  beta_hat_n?: number;

  // β_target: 生成目标
  beta_target?: number;

  // 兼容旧代码: difficulty (deprecated)
  difficulty?: number;
}

/**
 * 学生能力参数 (IRT 术语)
 *
 * θ_student: 学生在知识图谱上的能力向量
 * mastery = sigmoid(theta)
 */
export interface StudentAbility {
  // θ_student: IRT 能力参数
  theta_student: Map<string, number>;

  // 掌握度 (mastery = sigmoid(theta))
  mastery: Map<string, number>;
}

/**
 * 因果效应参数
 *
 * 用于校准预测模型，考虑各种外部因素对答题结果的影响
 */
export interface CausalEffects {
  hint_effect: number;      // 提示效应: P(+hint) - P(no hint)
  learning_effect: number;   // 学习效应: 每次重复的增益
  fatigue_effect: number;    // 疲劳效应: 每题衰减
  guessing_effect: number;   // 猜测效应: 低能力学生的猜测概率
}

/**
 * 因果观测数据
 *
 * 用于估计因果效应
 */
export interface CausalObservation {
  student_id: string;
  question_id: string;
  topic: string;
  theta: number;  // 学生能力
  correct: boolean;
  has_hint: boolean;
  attempt_number: number;  // 该知识点的尝试次数
  continuous_count: number;  // 连续答题数
}

/**
 * 题目生成规范
 *
 * 用于指导题目生成器生成指定复杂度的题目
 */
export interface ComplexitySpec {
  reasoningDepth: 1 | 2 | 3;  // 推理深度
  structure: 'linear' | 'nested' | 'multi_equation';  // 结构类型
  distractors: 0 | 1 | 2;  // 干扰项数量
}

/**
 * 生成的题目
 */
export interface GeneratedQuestion {
  complexitySpec: ComplexitySpec;
  features: QuestionFeatures;
  content: string;
}

/**
 * 预测上下文 - 明确区分学生能力和题目参数
 *
 * 新版本：使用 PredictionContext 替代 Context
 */
export interface PredictionContext {
  // 学生能力
  student_ability: Map<string, number>;

  // 题目参数 (使用 β_hat)
  question_params: {
    beta_hat: number;
    discrimination: number;  // IRT a 参数
    guessing: number;        // IRT c 参数
  };

  // 复杂度特征
  features: {
    cognitiveLoad: number;
    reasoningDepth: number;
    complexity: number;
  };

  // 因果上下文
  causal?: {
    has_hint: boolean;
    attempt_number: number;
    continuous_count: number;
  };
}

/**
 * @deprecated 使用 PredictionContext 替代
 * 保留用于向后兼容
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

export interface RecommendationRationale {
  currentMastery: number;
  targetComplexity: number;
  complexityGap: number;
  reason: string;
}

export type Action =
  | { type: 'recommend'; topic: string; reason: string }
  | { type: 'recommend_question'; questionId: string; topic: string; rationale: RecommendationRationale }
  | { type: 'gap_report'; gaps: Gap[] }
  | { type: 'done'; reason: string }
  | { type: 'error'; reason: string };

export interface Gap {
  topic: string;
  mastery: number;
  type: 'weak_knowledge' | 'missing_questions';
  count?: number;
}

// ========== Phase 3: 统一目标函数 ==========

/**
 * 损失函数组件
 *
 * 用于统一目标函数 L = L_IRT + λ_promotion · L_promotion + λ_generator · L_generator
 */
export interface LossComponents {
  irt_loss: number;
  promotion_loss: number;
  generator_loss: number;
}

/**
 * 预测结果
 */
export interface PredictionResult {
  predicted: number;
  actual: 0 | 1;
  student_id: string;
  question_id: string;
  topic: string;
}

// ========== 题目生成相关 ==========

/**
 * 题目模板
 */
export interface QuestionTemplate {
  template: string;
  spec: ComplexitySpec;
  params?: Record<string, number>;
}
