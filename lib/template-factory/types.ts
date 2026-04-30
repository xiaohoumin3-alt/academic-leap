/**
 * Template Factory Type Definitions
 */

// ============================================================================
// Parser Types (Legacy - for backward compatibility)
// ============================================================================

export interface ParseResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

export interface TextbookChapter {
  number: number;
  name: string;
  knowledgePoints: Array<{ name: string; weight: number }>;
}

export interface QuestionSample {
  content: string;
  difficulty: number;
  answer: string;
  stepType: StepTypeKey;
  knowledgePoint: string;
}

export type StepTypeKey =
  | 'COMPUTE_SQRT' | 'SIMPLIFY_SQRT' | 'SQRT_MIXED'
  | 'VERIFY_RIGHT_ANGLE' | 'VERIFY_PARALLELOGRAM' | 'VERIFY_RECTANGLE'
  | 'VERIFY_RHOMBUS' | 'VERIFY_SQUARE' | 'COMPUTE_RECT_PROPERTY'
  | 'COMPUTE_RHOMBUS_PROPERTY' | 'COMPUTE_SQUARE_PROPERTY'
  | 'IDENTIFY_QUADRATIC' | 'SOLVE_DIRECT_ROOT' | 'SOLVE_COMPLETE_SQUARE'
  | 'SOLVE_QUADRATIC_FORMULA' | 'SOLVE_FACTORIZE' | 'QUADRATIC_APPLICATION'
  | 'COMPUTE_MEAN' | 'COMPUTE_MEDIAN' | 'COMPUTE_MODE'
  | 'COMPUTE_VARIANCE' | 'COMPUTE_STDDEV';

// ============================================================================
// Knowledge Gap Detection
// ============================================================================

export interface KnowledgeGap {
  knowledgePointId: string;
  knowledgePointName: string;
  currentTemplateCount: number;
  targetTemplateCount: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
}

// ============================================================================
// Template Generation
// ============================================================================

export interface GenerationRequest {
  knowledgePoint: {
    id: string;
    name: string;
    description?: string;
  };
  targetStructures: StructureType[];
  targetDepths: DepthLevel[];
  count: number;
  context: {
    textbook?: string;
    grade: number;
    relatedConcepts: string[];
  };
}

export type StructureType = 'linear' | 'nested' | 'multi_equation' | 'constraint_chain';
export type DepthLevel = 1 | 2 | 3 | 4;

export interface GeneratedTemplate {
  name: string;
  template: string;
  answer: string;
  params: Record<string, ParamRange>;
  constraint: string;
  steps: string[];
  hint: string;
  difficulty: number;  // 1-5
  cognitiveLoad: number;  // 0-1
  reasoningDepth: number;  // 0-1
  learningObjective: string;
  concepts: string[];
}

export interface ParamRange {
  type: 'range' | 'set' | 'expression';
  min?: number;
  max?: number;
  values?: number[];
  expression?: string;
}

export interface GenerationResult {
  generationId: string;
  templates: GeneratedTemplate[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============================================================================
// Template Validation
// ============================================================================

export interface ValidationResult {
  templateId: string;
  mathCorrectness: {
    passed: boolean;
    issues: string[];
    confidence: number;  // 0-1
  };
  pedagogyQuality: {
    passed: boolean;
    issues: string[];
    score: number;  // 0-100
  };
  overallScore: number;  // 0-100
  recommendation: 'approve' | 'review' | 'reject';
}

// ============================================================================
// Quality Scoring
// ============================================================================

export interface QualityScore {
  mathCorrectness: number;  // 40% weight
  pedagogyQuality: number;   // 30% weight
  difficultyAccuracy: number; // 15% weight
  completeness: number;       // 10% weight
  innovation: number;         // 5% weight
  overall: number;            // 0-100
}

// ============================================================================
// Review Queue
// ============================================================================

export interface ReviewQueueItem {
  id: string;
  templateId: string;
  knowledgePoint: string;
  template: GeneratedTemplate;
  validationResult: ValidationResult;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  estimatedTime: number;  // seconds
}

export interface ReviewDecision {
  decision: 'approve' | 'reject' | 'modify';
  notes?: string;
  modifications?: Partial<GeneratedTemplate>;
}

// ============================================================================
// Coverage Report
// ============================================================================

export interface CoverageReport {
  total: number;
  covered: number;
  coverageRate: number;
  byKnowledgePoint: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    gap: number;
    priority: string;
  }>;
  gaps: {
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// LLM Client
// ============================================================================

export interface LLMClientConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gpt-4' | 'gpt-3.5-turbo';
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse<T = unknown> {
  content: string;
  parsed?: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}
