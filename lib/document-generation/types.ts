// ============================================================================
// Document Generation Types - Gizmo AI 逆向工程实现
// ============================================================================

// ============================================================================
// 输入类型
// ============================================================================

export interface DocumentUploadInput {
  file?: File;
  url?: string;
  type: 'pdf' | 'docx' | 'txt' | 'markdown' | 'youtube' | 'article';
  options?: GenerationOptions;
}

export interface GenerationOptions {
  language?: string;
  difficultyLevel?: number;
  questionTypes?: QuestionType[];
  maxCards?: number;
  maxQuestions?: number;
  includeExplanations?: boolean;
  targetAudience?: 'elementary' | 'middle' | 'high' | 'college' | 'professional';
}

export type QuestionType =
  | 'multiple-choice'
  | 'fill-blank'
  | 'true-false'
  | 'short-answer'
  | 'matching';

// ============================================================================
// 文档处理类型
// ============================================================================

export interface ParsedDocument {
  id: string;
  originalFileName: string;
  mimeType: string;

  // Content
  title: string;
  content: string;
  htmlContent?: string;

  // Metadata
  metadata: DocumentMetadata;

  // Structure
  chunks: DocumentChunk[];

  // AI Analysis
  analysis?: DocumentAnalysis;
}

export interface DocumentMetadata {
  wordCount: number;
  pageCount?: number;
  language: string;
  readingTimeMinutes: number;
  extractedAt: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  type: ChunkType;
  level?: number;
  metadata: ChunkMetadata;
  semanticTags?: string[];
}

export type ChunkType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'code'
  | 'table'
  | 'image';

export interface ChunkMetadata {
  startIndex: number;
  endIndex: number;
  pageIndex?: number;
}

export interface DocumentAnalysis {
  topics: Topic[];
  difficultyLevel: number;
  prerequisites?: string[];
  summary: string;
  keyConcepts: string[];
  suggestedTags: string[];
}

export interface Topic {
  id: string;
  name: string;
  level: number;
  parentTopicId?: string;
  subtopics: string[];
  keyConcepts: string[];
  difficulty: number;
  relevanceScore: number;
}

// ============================================================================
// 生成内容类型
// ============================================================================

export interface GeneratedContent {
  taskId: string;
  documentId: string;
  status: GenerationStatus;

  result?: GenerationResult;
  error?: string;

  createdAt: string;
  completedAt?: string;
}

export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface GenerationResult {
  flashcards: Flashcard[];
  questions: Question[];
  topics: Topic[];
  summary: string;

  statistics: GenerationStatistics;
  quality: QualityMetrics;
}

export interface GenerationStatistics {
  totalFlashcards: number;
  totalQuestions: number;
  difficultyDistribution: Record<number, number>;
  topicCoverage: Record<string, number>;
  questionTypeDistribution: Record<QuestionType, number>;
}

export interface QualityMetrics {
  confidenceScore: number;
  completenessScore: number;
  validationWarnings?: ValidationWarning[];
}

export interface ValidationWarning {
  type: 'accuracy' | 'clarity' | 'difficulty' | 'duplicate';
  severity: 'low' | 'medium' | 'high';
  message: string;
  itemId?: string;
}

// ============================================================================
// Flashcard 类型
// ============================================================================

export interface Flashcard {
  id: string;
  documentId: string;
  topicId: string;

  front: FlashcardFront;
  back: FlashcardBack;

  source: SourceReference;
  metadata: FlashcardMetadata;

  createdAt: string;
}

export interface FlashcardFront {
  text: string;
  type: FlashcardType;
  difficulty: number;
}

export type FlashcardType =
  | 'definition'
  | 'question'
  | 'comparison'
  | 'cause-effect'
  | 'example';

export interface FlashcardBack {
  text: string;
  explanation?: string;
  examples?: string[];
  relatedConcepts?: string[];
}

export interface SourceReference {
  chunkIds: string[];
  pageIndex?: number;
  excerpt?: string;
  confidence: number;
}

export interface FlashcardMetadata {
  bloomLevel: BloomLevel;
  tags: string[];
  averageRating?: number;
  timesReviewed?: number;
  lastReviewedAt?: string;
}

export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

// ============================================================================
// Question 类型
// ============================================================================

export interface Question {
  id: string;
  documentId: string;
  topicId: string;

  type: QuestionType;

  prompt: QuestionPrompt;

  // Type-specific fields
  options?: QuestionOption[];
  blanks?: BlankField[];
  statement?: string;
  pairs?: MatchingPair[];

  answer: QuestionAnswer;
  source: SourceReference;
  metadata: QuestionMetadata;

  createdAt: string;
}

export interface QuestionPrompt {
  text: string;
  context?: string;
  difficulty: number;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface BlankField {
  id: string;
  answer: string;
  position: number;
  hints?: string[];
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuestionAnswer {
  text: string;
  explanation: string;
  hints?: string[];
}

export interface QuestionMetadata {
  bloomLevel: BloomLevel;
  tags: string[];
  averageCorrect?: number;
  timesAttempted?: number;
  averageTimeSeconds?: number;
  lastAttemptedAt?: string;
}

// ============================================================================
// 任务管理类型
// ============================================================================

export interface GenerationTask {
  id: string;
  documentId: string;
  status: GenerationStatus;
  progress: number;

  stages: TaskStage[];

  result?: GenerationResult;
  error?: string;

  createdAt: string;
  completedAt?: string;
  estimatedCompletionAt?: string;
}

export interface TaskStage {
  name: StageName;
  status: GenerationStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type StageName =
  | 'parsing'
  | 'analyzing'
  | 'extracting'
  | 'generating-flashcards'
  | 'generating-questions'
  | 'validating';

// ============================================================================
// 用户反馈类型
// ============================================================================

export interface UserFeedback {
  itemId: string;
  itemType: 'flashcard' | 'question';
  type: 'rating' | 'error' | 'suggestion';
  rating?: number;
  errorType?: 'inaccurate' | 'unclear' | 'wrong-answer' | 'other';
  comment?: string;
  timestamp: string;
}

// ============================================================================
// API 响应类型
// ============================================================================

export interface UploadResponse {
  documentId: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface GenerationResponse {
  taskId: string;
  status: GenerationStatus;
  estimatedTime?: number;
}

export interface TaskStatusResponse {
  taskId: string;
  status: GenerationStatus;
  progress: number;
  currentStage?: string;
  result?: GenerationResult;
  error?: string;
}

// ============================================================================
// 错误类型
// ============================================================================

export interface GenerationError {
  code: ErrorCode;
  message: string;
  details?: any;
}

export type ErrorCode =
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PARSE_FAILED'
  | 'CONTENT_TOO_SHORT'
  | 'CONTENT_TOO_LONG'
  | 'GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMIT_EXCEEDED';

// ============================================================================
// Prompt 工程类型
// ============================================================================

export interface PromptTemplate {
  system: string;
  user: string;
  outputFormat: 'json' | 'text';
}

export interface FlashcardGenerationPrompt {
  documentContent: string;
  topic: string;
  difficulty: number;
  count: number;
}

export interface QuestionGenerationPrompt {
  documentContent: string;
  questionType: QuestionType;
  difficulty: number;
  count: number;
  context?: string;
}

// ============================================================================
// 质量验证类型
// ============================================================================

export interface ValidationResult {
  passed: boolean;
  warnings: ValidationWarning[];
  score: number;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  confidence: number;
  message?: string;
}

// ============================================================================
// LLM 配置类型
// ============================================================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  timeout: 30000
};

export const FAST_LLM_CONFIG: LLMConfig = {
  model: 'gpt-3.5-turbo',
  temperature: 0.5,
  maxTokens: 1000,
  timeout: 15000
};
