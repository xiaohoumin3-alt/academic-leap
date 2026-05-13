/**
 * DeepTutor Generator
 * 从 QuestionTemplate 生成完整的 QAPair
 */

import { callLLM, parseJSONResponse } from '../ai/generation/minimax'
import type { QuestionTemplate, QAPair, GeneratorResponse } from './models'

const GENERATOR_SYSTEM = `你是题目生成流程中的 Generator。
从结构化的 QuestionTemplate 生成高质量的问答对。`

interface GeneratorParams {
  template: QuestionTemplate
  topic: string
  knowledgeContext?: string
  previousQuestions: string[]
}

export class Generator {
  /**
   * 生成问答对
   */
  async process(params: GeneratorParams): Promise<QAPair> {
    const { template, topic, knowledgeContext = '', previousQuestions } = params

    const userPrompt = this.buildPrompt({
      template,
      topic,
      knowledgeContext,
      previousQuestions
    })

    const response = await callLLM({
      systemPrompt: GENERATOR_SYSTEM,
      userPrompt
    })

    const parsed = parseJSONResponse<GeneratorResponse>(response)
    if (!parsed) {
      throw new Error('Failed to parse Generator response')
    }

    // 验证必填字段
    if (!parsed.question || !parsed.correct_answer) {
      throw new Error('Generator response missing required fields')
    }

    // 验证题型一致性
    if (parsed.question_type !== template.question_type) {
      throw new Error(`Question type mismatch: expected ${template.question_type}, got ${parsed.question_type}`)
    }

    const qaPair: QAPair = {
      question_id: template.question_id,
      question: parsed.question,
      question_type: parsed.question_type,
      correct_answer: parsed.correct_answer,
      explanation: parsed.explanation || '',
      concentration: template.concentration,
      difficulty: template.difficulty
    }

    // choice 类型需要 options
    if (template.question_type === 'choice') {
      if (!parsed.options || Object.keys(parsed.options).length !== 4) {
        throw new Error('Choice question must have 4 options')
      }
      qaPair.options = parsed.options
    }

    return qaPair
  }

  private buildPrompt(params: GeneratorParams): string {
    const { template, topic, knowledgeContext, previousQuestions } = params

    return `QuestionTemplate:
${JSON.stringify(template, null, 2)}

用户主题：
${topic}

知识依据：
${knowledgeContext || '无'}

已生成的题目（你的新题目必须与所有这些题目不同）：
${previousQuestions.length > 0 ? previousQuestions.join('\n') : '无'}

要求：
- 严格保持与 template.concentration 和 template.difficulty 一致
- 严格遵守 template.question_type
- choice 类型：4个选项，正确答案不能明显更长
- written/calculation 类型：不提供选项
- 提供清晰的解释

仅返回 JSON：
{
  "question_type": "choice 或 written 或 calculation",
  "question": "题目内容",
  "options": {"A":"...","B":"...","C":"...","D":"..."} 或 null,
  "correct_answer": "选择题用选项键；简答/计算题用参考答案本身",
  "explanation": "详细解释"
}`
  }
}
