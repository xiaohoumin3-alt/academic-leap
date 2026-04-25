import { NextRequest, NextResponse } from 'next/server';
import { importFromPreview } from '@/lib/template-factory/importer';
import type { PreviewResult } from '@/lib/template-factory/preview-engine';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/factory/import
 * 从预览数据导入到数据库
 *
 * 请求体:
 * {
 *   preview: PreviewResult,  // 预览结果
 *   options: {
 *     createKnowledgePoints: boolean,
 *     createSkeletons: boolean,
 *     createTemplates: boolean
 *   }
 * }
 *
 * 响应:
 * {
 *   success: boolean,
 *   data?: ImportResults,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const body = await request.json();
    const { preview, options } = body as {
      preview: PreviewResult;
      options: {
        createKnowledgePoints: boolean;
        createSkeletons: boolean;
        createTemplates: boolean;
      };
    };

    if (!preview || !options) {
      return NextResponse.json({
        success: false,
        error: 'preview and options are required'
      }, { status: 400 });
    }

    // 验证至少有一个选项被启用
    if (!options.createSkeletons && !options.createTemplates && !options.createKnowledgePoints) {
      return NextResponse.json({
        success: false,
        error: 'At least one create option must be enabled'
      }, { status: 400 });
    }

    const results = await importFromPreview(preview, options);

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error importing:', error);
    return NextResponse.json({
      success: false,
      error: '导入失败'
    }, { status: 500 });
  }
}