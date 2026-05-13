import { NextRequest, NextResponse } from 'next/server'
import { AgentCoordinator } from '@/lib/deeptutor/coordinator'
import type { GenerationRequest } from '@/lib/deeptutor/models'

const MAX_QUESTIONS = 50
const MAX_TOPIC_LENGTH = 200
const MAX_PREFERENCE_LENGTH = 500
const MAX_CONTEXT_LENGTH = 1000

/**
 * POST /api/questions/deeptutor/generate
 * DeepTutor 题目生成 API
 *
 * ⚠️ 测试专用端点 - 不应用于生产环境
 * 此端点缺少身份验证和速率限制，仅供开发测试使用
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 参数验证
    const validationError = validateRequest(body)
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError, code: 'INVALID_PARAMS' },
        { status: 400 }
      )
    }

    const request = body as GenerationRequest
    const coordinator = new AgentCoordinator()
    const result = await coordinator.generate(request)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[DeepTutor] Generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

function validateRequest(body: any): string | null {
  if (!body.topic || typeof body.topic !== 'string') {
    return 'topic is required'
  }

  if (body.topic.length > MAX_TOPIC_LENGTH) {
    return `topic exceeds maximum length of ${MAX_TOPIC_LENGTH}`
  }

  if (body.preference && typeof body.preference === 'string' && body.preference.length > MAX_PREFERENCE_LENGTH) {
    return `preference exceeds maximum length of ${MAX_PREFERENCE_LENGTH}`
  }

  if (body.knowledgeContext && typeof body.knowledgeContext === 'string' && body.knowledgeContext.length > MAX_CONTEXT_LENGTH) {
    return `knowledgeContext exceeds maximum length of ${MAX_CONTEXT_LENGTH}`
  }

  if (body.mode !== 'custom') {
    return 'Invalid mode. Only "custom" is supported in v1.'
  }

  if (body.count < 1 || body.count > MAX_QUESTIONS) {
    return `count must be between 1 and ${MAX_QUESTIONS}`
  }

  return null
}
