/**
 * DeepTutor AgentCoordinator
 * 协调 IdeaAgent 和 Generator，实现批处理和去重
 */

import { IdeaAgent } from './idea-agent'
import { Generator } from './generator'
import type {
  GenerationRequest,
  GenerationResult,
  QuestionTemplate,
  QAPair
} from './models'

// 常量配置
const BATCH_SIZE = 5
const MAX_QUESTIONS = 50
const DEFAULT_COUNT = 3
const MAX_ITERATIONS = Math.ceil(MAX_QUESTIONS / BATCH_SIZE) + 2 // 最多 12 次迭代

export class AgentCoordinator {
  private ideaAgent: IdeaAgent
  private generator: Generator
  private usedConcentrations = new Set<string>()
  private generatedQuestions: QAPair[] = []

  constructor() {
    this.ideaAgent = new IdeaAgent()
    this.generator = new Generator()
  }

  /**
   * 生成题目（主入口）
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const { count, topic, preference, knowledgeContext, difficulty, questionType } = request

    // 参数验证
    const requestedCount = Math.min(count, MAX_QUESTIONS)

    // 初始化结果
    const results: GenerationResult['results'] = []
    let templates: QuestionTemplate[] = []

    // 批量生成模板（带迭代上限防止死循环）
    let iterations = 0
    while (templates.length < requestedCount && iterations < MAX_ITERATIONS) {
      iterations++

      const numIdeas = Math.min(BATCH_SIZE, requestedCount - templates.length)

      const newTemplates = await this.ideaAgent.process({
        topic,
        preference,
        knowledgeContext,
        existingConcentrations: Array.from(this.usedConcentrations),
        numIdeas,
        difficulty,
        questionType
      })

      // 无进展时退出循环（防止死循环）
      if (newTemplates.length === 0) {
        console.warn(`[AgentCoordinator] No templates generated at iteration ${iterations}, stopping`)
        break
      }

      // 更新已使用的考察点
      this.updateConcentrations(newTemplates)
      templates.push(...newTemplates)
    }

    // 限制模板数量
    templates = templates.slice(0, requestedCount)

    // 为每个模板生成完整题目
    for (const template of templates) {
      try {
        const qaPair = await this.generator.process({
          template,
          topic,
          knowledgeContext,
          previousQuestions: this.getPreviousQuestions()
        })

        results.push({
          template,
          qa_pair: qaPair,
          success: true
        })

        this.generatedQuestions.push(qaPair)
      } catch (error) {
        // 失败时添加 fallback
        results.push({
          template,
          qa_pair: this.createFallbackQAPair(template, error),
          success: false
        })
      }
    }

    const completed = results.filter((r) => r.success).length
    const failed = results.length - completed

    return {
      success: failed === 0,
      error: failed > 0 ? `${failed} questions failed to generate` : undefined,
      source: 'topic',
      requested: requestedCount,
      template_count: templates.length,
      completed,
      failed,
      results
    }
  }

  private updateConcentrations(templates: QuestionTemplate[]) {
    templates.forEach((t) => {
      this.usedConcentrations.add(t.concentration.toLowerCase())
    })
  }

  private getPreviousQuestions(): string[] {
    return this.generatedQuestions.map((q) => q.question)
  }

  private createFallbackQAPair(template: QuestionTemplate, error: unknown): QAPair {
    const fallback: QAPair = {
      question_id: template.question_id,
      question: `[生成失败] ${template.concentration}`,
      question_type: template.question_type,
      correct_answer: 'N/A',
      explanation: String(error),
      concentration: template.concentration,
      difficulty: template.difficulty
    }

    // choice 类型需要 options 字段（其他类型的 options 保持 undefined）
    if (template.question_type === 'choice') {
      fallback.options = {
        A: '生成失败，请重试',
        B: '生成失败，请重试',
        C: '生成失败，请重试',
        D: '生成失败，请重试'
      }
    }

    return fallback
  }
}
