/**
 * AI模型列表API
 *
 * GET /api/ai/models
 * 返回所有可用的AI模型
 */

import { NextResponse } from 'next/server';
import { ModelAdapter } from '@/lib/ai/model-adapter';

export async function GET() {
  try {
    const models = ModelAdapter.getAvailableModels();

    return NextResponse.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models'
      },
      { status: 500 }
    );
  }
}
