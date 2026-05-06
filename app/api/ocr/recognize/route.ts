import { NextRequest, NextResponse } from 'next/server';
import { recognizeHandwriting, normalizeMathExpression } from '@/lib/ocr';
import { auth } from '@/lib/auth';
import { checkRateLimit, hasRateLimit } from '@/lib/rate-limit';

// 验证请求
function validateRequest(body: unknown): { image?: string; questionId?: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.image !== 'string' || !b.image) return null;
  return { image: b.image, questionId: typeof b.questionId === 'string' ? b.questionId : undefined };
}

// 安全错误响应
function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // 1. 认证检查
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse('未授权访问', 401);
  }

  // 2. 速率限制检查
  if (hasRateLimit('ocr')) {
    const rateLimit = await checkRateLimit(`ocr:${session.user.id}`, { windowMs: 60000, maxRequests: 20 });
    if (!rateLimit.allowed) {
      return errorResponse('请求过于频繁，请稍后再试', 429);
    }
  }

  // 3. 输入验证
  const body = await request.json().catch(() => null);
  const validated = validateRequest(body);
  if (!validated || !validated.image) {
    return errorResponse('缺少图片数据', 400);
  }
  const image = validated.image;

  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse('缺少API密钥配置', 500);
    }

    const result = await recognizeHandwriting(image, apiKey);
    const normalizedExpressions = result.expressions.map(normalizeMathExpression);

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        confidence: result.confidence,
        expressions: result.expressions,
        normalizedExpressions,
        primaryExpression: normalizedExpressions[0] || result.text,
      },
    });
  } catch (error) {
    console.error('OCR识别失败:', error);
    return NextResponse.json(
      { success: false, error: 'OCR识别失败' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
