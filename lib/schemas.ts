/**
 * API Input Validation Schemas
 *
 * 使用Zod进行输入验证
 */

import { z } from 'zod';

// ============================================================
// 游戏化API Schemas
// ============================================================

// POST /api/gaming - 处理游戏化事件
export const gamingEventSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  attemptId: z.string().min(1, 'attemptId is required'),
  questionId: z.string().min(1, 'questionId is required'),
  isCorrect: z.boolean().default(false),
  leDelta: z.number().default(0),
  duration: z.number().int().min(0).default(0),
});

// 输入类型（应用 defaults 后的输出类型）
export type GamingEventInput = z.output<typeof gamingEventSchema>;

// PATCH /api/gaming - 更新玩家设置
export const updatePlayerSchema = z.object({
  theme: z.enum(['adventure', 'sci-fi', 'fantasy', 'sports']).optional(),
  character: z.string().min(1).max(50).optional(),
});

// GET /api/gaming/leaderboard - 排行榜查询
export const leaderboardQuerySchema = z.object({
  theme: z.enum(['adventure', 'sci-fi', 'fantasy', 'sports']).optional(),
  character: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// PUT /api/gaming/parental/settings - 家长控制设置
export const parentalSettingsSchema = z.object({
  gamificationEnabled: z.boolean().optional(),
  dailyXPCap: z.number().int().min(0).max(5000).optional(),
  allowedTimeStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  allowedTimeEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
  showRankings: z.boolean().optional(),
  rewardThreshold: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    // 验证结束时间晚于开始时间
    if (data.allowedTimeStart && data.allowedTimeEnd) {
      const [startHour, startMin] = data.allowedTimeStart.split(':').map(Number);
      const [endHour, endMin] = data.allowedTimeEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return endMinutes > startMinutes;
    }
    return true;
  },
  {
    message: 'allowedTimeEnd must be after allowedTimeStart',
  }
);

// GET /api/gaming/parental/trend - 趋势查询
export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional().default(7),
});

// ============================================================
// 验证辅助函数
// ============================================================

/**
 * 验证请求体
 * 返回 schema 的 output 类型（应用 defaults/refine 后）
 */
export async function validateJson<Schema extends z.ZodTypeAny>(
  schema: Schema,
  request: Request
): Promise<z.output<Schema>> {
  try {
    const body = await request.json();
    return schema.parse(body) as z.output<Schema>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors);
    }
    throw error;
  }
}

/**
 * 验证查询参数
 */
export function validateQuery<Schema extends z.ZodTypeAny>(
  schema: Schema,
  searchParams: URLSearchParams
): z.output<Schema> {
  try {
    const params = Object.fromEntries(searchParams.entries());
    return schema.parse(params) as z.output<Schema>;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors);
    }
    throw error;
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends Error {
  constructor(public errors: z.ZodIssue[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }

  toResponse() {
    return {
      error: 'Validation failed',
      details: this.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
}
