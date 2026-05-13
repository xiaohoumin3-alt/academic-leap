/**
 * 统一错误响应类型定义
 *
 * 用于推荐引擎的标准化错误响应，提供可操作的错误信息。
 */

/**
 * 错误码枚举
 * 用户侧错误需要用户操作，系统侧错误需要系统操作
 */
export enum ErrorCode {
  // === 用户侧错误（需要用户操作）===
  NEEDS_DIAGNOSTIC = 'NEEDS_DIAGNOSTIC',        // "请先完成诊断测评"
  NO_LEARNING_PATH = 'NO_LEARNING_PATH',        // "请先创建学习路径"
  ALL_TOPICS_MASTERED = 'ALL_TOPICS_MASTERED',  // "您已完成所有知识点的学习！"

  // === 系统侧错误（需要系统操作）===
  TOPIC_NO_QUESTIONS = 'TOPIC_NO_QUESTIONS',    // "正在为您生成题目..."
  GENERATION_FAILED = 'GENERATION_FAILED',      // "系统繁忙，请稍后重试"
  SYSTEM_ERROR = 'SYSTEM_ERROR',               // "服务器错误，请联系支持"

  // === 数据错误（需要数据修复）===
  NO_TOPICS_DEFINED = 'NO_TOPICS_DEFINED',      // "请联系管理员配置知识点"
}

/**
 * 错误码到操作提示的映射
 */
export const ErrorActionMap: Record<ErrorCode, string> = {
  [ErrorCode.NEEDS_DIAGNOSTIC]: '点击这里完成诊断测评（约 10 分钟）',
  [ErrorCode.NO_LEARNING_PATH]: '请先创建一个学习路径来开始您的学习之旅',
  [ErrorCode.ALL_TOPICS_MASTERED]: '可以回顾错题集，或联系老师开启下一阶段',
  [ErrorCode.TOPIC_NO_QUESTIONS]: '正在为您智能生成题目，预计需要 10-15 秒...',
  [ErrorCode.GENERATION_FAILED]: '系统繁忙，请稍后重试。如果问题持续存在，请联系支持',
  [ErrorCode.SYSTEM_ERROR]: '服务器遇到问题，请稍后重试。如果问题持续存在，请联系支持',
  [ErrorCode.NO_TOPICS_DEFINED]: '请联系管理员配置知识点',
};

/**
 * 错误码到默认消息的映射
 */
export const ErrorMessageMap: Record<ErrorCode, string> = {
  [ErrorCode.NEEDS_DIAGNOSTIC]: '在开始个性化练习前，需要先了解您的学习起点',
  [ErrorCode.NO_LEARNING_PATH]: '需要先创建学习路径才能开始个性化推荐',
  [ErrorCode.ALL_TOPICS_MASTERED]: '恭喜！您已完成所有知识点的学习',
  [ErrorCode.TOPIC_NO_QUESTIONS]: '当前知识点暂无可用题目',
  [ErrorCode.GENERATION_FAILED]: '题目生成遇到问题',
  [ErrorCode.SYSTEM_ERROR]: '服务器遇到未知问题',
  [ErrorCode.NO_TOPICS_DEFINED]: '当前没有可用的知识点配置',
};

/**
 * 推荐错误结构
 */
export interface RecommendationError {
  code: ErrorCode;
  message: string;
  action: string;
  details?: Record<string, unknown>;
}

/**
 * 推荐成功响应
 */
export interface RecommendationSuccess {
  questionId: string;
  questionContent: unknown;
  beforeProbability: number;
  afterProbability?: number;
  rationale: string;
  knowledgePointId: string;
  complexity?: number;
  cognitiveLoad?: number;
  reasoningDepth?: number;
}

/**
 * 统一推荐响应
 */
export interface RecommendationResponse {
  success: boolean;
  data?: RecommendationSuccess;
  error?: RecommendationError;
}

/**
 * 创建错误响应的工厂函数
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: Record<string, unknown>
): RecommendationError {
  return {
    code,
    message: ErrorMessageMap[code],
    action: ErrorActionMap[code],
    details,
  };
}

/**
 * 创建成功响应的工厂函数
 */
export function createSuccessResponse(
  question: {
    id: string;
    content: unknown;
    cognitiveLoad?: number | null;
    reasoningDepth?: number | null;
    complexity?: number | null;
  },
  knowledgePointId: string,
  beforeProbability: number,
  rationale: string
): RecommendationSuccess {
  return {
    questionId: question.id,
    questionContent: question.content,
    beforeProbability,
    rationale,
    knowledgePointId,
    complexity: question.complexity ?? undefined,
    cognitiveLoad: question.cognitiveLoad ?? undefined,
    reasoningDepth: question.reasoningDepth ?? undefined,
  };
}

/**
 * 创建统一推荐响应的工厂函数
 */
export function createRecommendationResponse(
  success: boolean,
  data?: RecommendationSuccess,
  error?: RecommendationError
): RecommendationResponse {
  return {
    success,
    ...(data && { data }),
    ...(error && { error }),
  };
}