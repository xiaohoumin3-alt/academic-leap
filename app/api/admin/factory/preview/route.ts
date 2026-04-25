import { NextRequest, NextResponse } from 'next/server';
import { parseTextbook, parseQuestionBank } from '@/lib/template-factory/parsers';
import { generatePreview } from '@/lib/template-factory/preview-engine';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/factory/preview
 * 生成预览数据
 *
 * 请求体:
 * {
 *   textbookYaml: string,    // 可选，教材 YAML 内容
 *   questionBankYaml: string // 可选，题库 YAML 内容
 * }
 *
 * 响应:
 * {
 *   success: boolean,
 *   data: {
 *     preview: PreviewResult,
 *     textbookErrors?: ValidationError[],
 *     questionErrors?: ValidationError[]
 *   },
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
    const { textbookYaml, questionBankYaml } = body;

    // 验证输入大小（防止过大输入）
    const maxSize = 500 * 1024; // 500KB
    if (textbookYaml && textbookYaml.length > maxSize) {
      return NextResponse.json({
        success: false,
        error: '教材内容过大，最大500KB'
      }, { status: 400 });
    }
    if (questionBankYaml && questionBankYaml.length > maxSize) {
      return NextResponse.json({
        success: false,
        error: '题库内容过大，最大500KB'
      }, { status: 400 });
    }

    // 解析教材
    const textbookResult = textbookYaml
      ? parseTextbook(textbookYaml)
      : null;

    // 解析题库
    const questionResult = questionBankYaml
      ? parseQuestionBank(questionBankYaml)
      : null;

    // 生成预览
    const preview = generatePreview(
      textbookResult?.data ?? null,
      questionResult?.data?.questions ?? null
    );

    return NextResponse.json({
      success: true,
      data: {
        preview,
        textbookErrors: textbookResult?.errors,
        questionErrors: questionResult?.errors
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      {
        success: false,
        error: '预览生成失败'
      },
      { status: 500 }
    );
  }
}