/**
 * UOK Experiment Validation API
 *
 * POST /api/uok/experiment/run - Run automated experiment validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runExperimentValidation, exportToCSV, exportToJSON } from '@/lib/qie/experiment-validator';

/**
 * POST /api/uok/experiment/run
 *
 * 运行自动化实验验证，回答 "UOK 是否真的优于 baseline"
 *
 * Query params:
 * - format: 'json' | 'csv' | 'both' (default: 'json')
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') ?? 'json';

    console.log('🔬 开始运行 UOK 实验验证...');

    // 运行实验
    const { report, data, exportData } = await runExperimentValidation();

    // 根据格式返回结果
    if (format === 'csv') {
      const csv = exportToCSV(exportData);
      return NextResponse.json({
        success: true,
        format: 'csv',
        report,
        csv,
        recordCount: exportData.length,
      });
    }

    if (format === 'both') {
      return NextResponse.json({
        success: true,
        format: 'both',
        report,
        json: exportToJSON(exportData),
        csv: exportToCSV(exportData),
        recordCount: exportData.length,
      });
    }

    // default: json
    return NextResponse.json({
      success: true,
      format: 'json',
      report,
      data: exportData,
      recordCount: exportData.length,
    });
  } catch (error) {
    console.error('Experiment validation error:', error);
    return NextResponse.json(
      {
        error: '实验验证失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uok/experiment/run
 *
 * 获取实验配置信息（不运行实验）
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    config: {
      sampleSize: 100,
      runs: 3,
      strategies: ['UOK', 'random', 'fixed', 'greedy'],
      metrics: [
        'Brier Score (预测能力)',
        'Questions to Mastery 0.7 (学习效率)',
        'Complexity Growth (复杂度提升)',
        'Accuracy (准确率)',
      ],
    },
  });
}
