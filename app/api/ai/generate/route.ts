/**
 * 统一AI生成API
 *
 * POST /api/ai/generate
 * 统一接口调用多个AI模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { ModelAdapter, ModelType, TaskComplexity } from '@/lib/ai/model-adapter';

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

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.prompt) {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      );
    }

    // 如果指定了模型，使用指定模型
    // 否则根据任务复杂度自动选择
    let model: ModelType;
    if (body.model) {
      model = body.model;
    } else if (body.taskComplexity) {
      model = ModelAdapter.selectModelForTask(body.taskComplexity);
    } else {
      // 默认使用 Sonnet
      model = 'claude-sonnet-4.6';
    }

    const adapter = new ModelAdapter({ model });
    const result = await adapter.generate(body.prompt, body.options);

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
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate content'
      },
      { status: 500 }
    );
  }
}
