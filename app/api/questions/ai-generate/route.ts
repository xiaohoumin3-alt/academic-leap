/**
 * AI Question Generation API
 * POST /api/questions/ai-generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveCards, type QuestionType } from '@/lib/ai/generation'
import { getAIConfig } from '@/lib/ai/config'

// 请求参数类型
interface GenerateRequestBody {
  knowledgePointId: string
  content: string
  types: QuestionType[]
  count?: number
  difficulty?: number
  grade?: number
}

// 验证请求参数
function validateRequest(body: unknown): { valid: true; data: GenerateRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '请求体必须是 JSON 对象' }
  }

  const obj = body as Record<string, unknown>

  if (!obj.knowledgePointId || typeof obj.knowledgePointId !== 'string') {
    return { valid: false, error: '缺少必需参数: knowledgePointId' }
  }

  if (!obj.content || typeof obj.content !== 'string') {
    return { valid: false, error: '缺少必需参数: content' }
  }

  if (!obj.content.trim()) {
    return { valid: false, error: 'content 不能为空' }
  }

  if (!Array.isArray(obj.types) || obj.types.length === 0) {
    return { valid: false, error: '缺少必需参数: types (至少一种题型)' }
  }

  const validTypes: QuestionType[] = ['fill_blank', 'multiple_choice', 'short_answer']
  for (const type of obj.types) {
    if (!validTypes.includes(type as QuestionType)) {
      return { valid: false, error: `无效的题型: ${type}，有效值为: ${validTypes.join(', ')}` }
    }
  }

  if (obj.count !== undefined && (typeof obj.count !== 'number' || obj.count < 1 || obj.count > 100)) {
    return { valid: false, error: 'count 必须在 1-100 之间' }
  }

  if (obj.difficulty !== undefined && (typeof obj.difficulty !== 'number' || obj.difficulty < 1 || obj.difficulty > 12)) {
    return { valid: false, error: 'difficulty 必须在 1-12 之间' }
  }

  return {
    valid: true,
    data: {
      knowledgePointId: obj.knowledgePointId as string,
      content: obj.content as string,
      types: obj.types as QuestionType[],
      count: obj.count as number | undefined,
      difficulty: obj.difficulty as number | undefined,
      grade: obj.grade as number | undefined,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '无效的 JSON 请求体' }, { status: 400 })
    }

    // 验证参数
    const validation = validateRequest(body)
    if (!validation.valid) {
      const errorMessage = 'error' in validation ? validation.error : '参数验证失败'
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    const { knowledgePointId, content, types, count, difficulty, grade } = validation.data

    // 验证 AI 配置
    try {
      getAIConfig()
    } catch (configError) {
      console.error('[API] AI config error:', configError)
      return NextResponse.json(
        { error: 'AI 服务未配置，请联系管理员配置 MINIMAX_API_KEY' },
        { status: 503 }
      )
    }

    // 生成题目
    const result = await generateAndSaveCards({
      knowledgePointId,
      content,
      types,
      count: count || 10,
      difficulty,
      grade,
    })

    // 返回结果
    return NextResponse.json({
      success: true,
      questions: result.questions,
      totalCount: result.totalCount,
    })
  } catch (error) {
    console.error('[API] ai-generate error:', error)

    // 生成失败直接抛错，不做降级处理
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败，请稍后重试' },
      { status: 500 }
    )
  }
}

// GET 方法用于健康检查
export async function GET() {
  try {
    const config = getAIConfig()
    return NextResponse.json({
      status: 'ok',
      configured: true,
      model: config.model,
    })
  } catch {
    return NextResponse.json({
      status: 'ok',
      configured: false,
      message: 'MINIMAX_API_KEY not configured',
    })
  }
}
