/**
 * 统一AI生成API
 * POST /api/ai/generate
 * 统一接口调用多个AI模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { ModelAdapter, ModelType, TaskComplexity } from '@/lib/ai/model-adapter';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit, hasRateLimit } from '@/lib/rate-limit';

interface GenerateRequest {
  prompt: string;
  model?: ModelType;
  taskComplexity?: TaskComplexity;
  options?: {
    responseFormat?: 'text' | 'json';
    maxTokens?: number;
    temperature?: number;
  };
}

// 输入验证 schema
const generateSchema = z.object({
  prompt: z.string().min(1).max(10000), // 限制最大长度
  model: z.enum(['claude-haiku-4.5', 'claude-sonnet-4.6', 'claude-opus-4.7', 'gemini-2.5-flash', 'gemini-2.5-pro']).optional(),
  options: z.object({
    responseFormat: z.enum(['text', 'json']).optional(),
    maxTokens: z.number().min(1).max(8192).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
}).strict();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  // 1. 认证检查
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse('未授权访问', 401);
  }

  // 2. 速率限制检查
  if (hasRateLimit('ai_generate')) {
    const rateLimit = await checkRateLimit(`ai_generate:${session.user.id}`, { windowMs: 60000, maxRequests: 30 });
    if (!rateLimit.allowed) {
      return errorResponse('请求过于频繁，请稍后再试', 429);
    }
  }

  // 3. 输入解析与验证
  const body = await request.json().catch(() => null);
  if (!body) {
    return errorResponse('请求体无效', 400);
  }

  const parseResult = generateSchema.safeParse(body);
  if (!parseResult.success) {
    return errorResponse('请求参数无效: ' + parseResult.error.issues[0]?.message, 400);
  }

  try {
    let model: ModelType;
    if (parseResult.data.model) {
      model = parseResult.data.model;
    } else {
      model = 'claude-sonnet-4.6';
    }

    const adapter = new ModelAdapter({ model });
    const result = await adapter.generate(parseResult.data.prompt, parseResult.data.options);

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        model,
        usage: result.usage
      }
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { success: false, error: '生成内容失败' },
      { status: 500 }
    );
  }
}
