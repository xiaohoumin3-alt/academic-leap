import { NextRequest, NextResponse } from 'next/server';
import { recognizeHandwriting, normalizeMathExpression } from '@/lib/ocr';

export async function POST(request: NextRequest) {
  try {
    const { image, questionId } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: '缺少图片数据' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '缺少API密钥配置' },
        { status: 500 }
      );
    }

    // 进行OCR识别
    const result = await recognizeHandwriting(image, apiKey);

    // 规范化识别的表达式
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
      {
        success: false,
        error: error instanceof Error ? error.message : 'OCR识别失败',
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
