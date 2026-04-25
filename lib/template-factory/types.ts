/**
 * 模板工厂类型定义
 * 支持素材类型、步骤类型、骨架配置、难度参数和解析结果
 */

/**
 * 素材类型
 */
export type MaterialType = 'textbook' | 'question_bank' | 'mixed';

/**
 * 步骤类型 - 对应 StepType 枚举
 */
export type StepTypeKey =
  | 'COMPUTE_SQRT'
  | 'SIMPLIFY_SQRT'
  | 'SQRT_MIXED'
  | 'VERIFY_RIGHT_ANGLE'
  | 'VERIFY_PARALLELOGRAM'
  | 'VERIFY_RECTANGLE'
  | 'VERIFY_RHOMBUS'
  | 'VERIFY_SQUARE'
  | 'COMPUTE_RECT_PROPERTY'
  | 'COMPUTE_RHOMBUS_PROPERTY'
  | 'COMPUTE_SQUARE_PROPERTY'
  | 'IDENTIFY_QUADRATIC'
  | 'SOLVE_DIRECT_ROOT'
  | 'SOLVE_COMPLETE_SQUARE'
  | 'SOLVE_QUADRATIC_FORMULA'
  | 'SOLVE_FACTORIZE'
  | 'QUADRATIC_APPLICATION'
  | 'COMPUTE_MEAN'
  | 'COMPUTE_MEDIAN'
  | 'COMPUTE_MODE'
  | 'COMPUTE_VARIANCE'
  | 'COMPUTE_STDDEV';

/**
 * 骨架配置
 */
export interface SkeletonConfig {
  inputType: 'numeric' | 'coordinate' | 'fraction' | 'expression';
  keyboard: 'numeric' | 'coordinate' | 'fraction' | 'full';
  validation?: Record<string, unknown>;
}

/**
 * 难度参数约束类型
 */
export type ConstraintType = 'int' | 'perfect_square' | 'range' | 'special';

/**
 * 难度参数约束
 */
export interface ParamConstraint {
  param: string;
  type: ConstraintType;
  min?: number;
  max?: number;
  values?: number[];
}

/**
 * 难度配置
 */
export interface DifficultyConfig {
  level: number;
  constraints: ParamConstraint[];
}

/**
 * 知识权重
 */
export interface KnowledgeWeight {
  name: string;
  weight: number;
}

/**
 * 教材章节
 */
export interface TextbookChapter {
  number: number;
  name: string;
  knowledgePoints: KnowledgeWeight[];
}

/**
 * 题库题目示例
 */
export interface QuestionSample {
  content: string;
  difficulty: number;
  answer: string;
  stepType: StepTypeKey;
  knowledgePoint: string;
}

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 解析结果
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * 输入类型枚举（用于配置）
 */
export const INPUT_TYPES = ['numeric', 'coordinate', 'fraction', 'expression'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

/**
 * 键盘类型枚举（用于配置）
 */
export const KEYBOARD_TYPES = ['numeric', 'coordinate', 'fraction', 'full'] as const;
export type KeyboardType = (typeof KEYBOARD_TYPES)[number];

/**
 * 约束类型字面量
 */
export const CONSTRAINT_TYPES = ['int', 'perfect_square', 'range', 'special'] as const;
export type ConstraintTypeLiteral = (typeof CONSTRAINT_TYPES)[number];

/**
 * 素材类型字面量
 */
export const MATERIAL_TYPES = ['textbook', 'question_bank', 'mixed'] as const;
export type MaterialTypeLiteral = (typeof MATERIAL_TYPES)[number];