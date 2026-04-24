import { z } from 'zod';

/**
 * 知识点路径节点状态
 */
export const PathNodeStatusSchema = z.enum(['pending', 'learning', 'mastered', 'stale']);
export type PathNodeStatus = z.infer<typeof PathNodeStatusSchema>;

/**
 * 单个知识点路径节点
 */
export const PathKnowledgeNodeSchema = z.object({
  nodeId: z.string(),
  priority: z.number().min(0),
  status: PathNodeStatusSchema,
  addedAt: z.string(), // ISO 8601 日期字符串
  reasons: z.array(z.string())
});
export type PathKnowledgeNode = z.infer<typeof PathKnowledgeNodeSchema>;

/**
 * 优先级计算输入因子
 */
export interface PriorityFactorsInput {
  mastery: number;           // 0-1
  weight: number;            // 1-5
  daysSincePractice: number;
  recentFailureRate: number; // 0-1
  includeStale: boolean;
}

/**
 * 优先级计算结果
 */
export interface PriorityResult {
  score: number;
  breakdown: {
    baseScore: number;
    failureBonus: number;
    stalePenalty: number;
  };
}

/**
 * 路径调整变更
 */
export const PathAdjustmentChangesSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  reordered: z.array(z.object({
    nodeId: z.string(),
    oldPriority: z.number(),
    newPriority: z.number()
  }))
});
export type PathAdjustmentChanges = z.infer<typeof PathAdjustmentChangesSchema>;

/**
 * 路径类型
 */
export const PathTypeSchema = z.enum(['initial', 'weekly', 'manual']);
export type PathType = z.infer<typeof PathTypeSchema>;

/**
 * 路径调整类型
 */
export const AdjustmentTypeSchema = z.enum(['micro', 'weekly']);
export type AdjustmentType = z.infer<typeof AdjustmentTypeSchema>;

/**
 * 路径触发类型
 */
export const AdjustmentTriggerSchema = z.enum(['practice_completed', 'weekly_recalibration', 'manual']);
export type AdjustmentTrigger = z.infer<typeof AdjustmentTriggerSchema>;

/**
 * 周报摘要
 */
export const WeeklyReportSummarySchema = z.object({
  practicedCount: z.number().int().min(0),
  masteredCount: z.number().int().min(0),
  weakCount: z.number().int().min(0)
});
export type WeeklyReportSummary = z.infer<typeof WeeklyReportSummarySchema>;

/**
 * 周报stale知识点
 */
export const WeeklyReportStaleItemSchema = z.object({
  nodeId: z.string(),
  name: z.string(),
  lastPractice: z.string(), // ISO 8601
  mastery: z.number().min(0).max(1)
});
export type WeeklyReportStaleItem = z.infer<typeof WeeklyReportStaleItemSchema>;

/**
 * 周报推荐
 */
export const WeeklyReportRecommendationsSchema = z.object({
  toReview: z.array(z.string()),
  toLearn: z.array(z.string())
});
export type WeeklyReportRecommendations = z.infer<typeof WeeklyReportRecommendationsSchema>;

/**
 * 路径生成请求
 */
export const GeneratePathRequestSchema = z.object({
  assessmentId: z.string().optional(),
  userEdits: z.object({
    add: z.array(z.string()),
    remove: z.array(z.string())
  }).optional()
});
export type GeneratePathRequest = z.infer<typeof GeneratePathRequestSchema>;

/**
 * 路径查询响应
 */
export interface PathQueryResponse {
  path: {
    id: string;
    name: string;
    status: string;
    currentIndex: number;
  };
  roadmap: Array<{
    nodeId: string;
    name: string;
    status: 'completed' | 'current' | 'pending';
    mastery: number;
    priority: number;
  }>;
  weeklySummary: {
    practicedCount: number;
    masteredCount: number;
    weakCount: number;
  };
}

/**
 * API响应包装
 */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
}
