/**
 * DeepTutor IdeaAgent
 * 基于知识内容生成题目模板（考察点 + 类型 + 难度）
 */

import { callLLM, parseJSONResponse } from '../ai/generation/minimax'
import type {
  QuestionTemplate,
  IdeaAgentResponse,
  DeepTutorQuestionType,
  Difficulty
} from './models'

const IDEA_AGENT_SYSTEM = `你是考试题目设计流程中的 Idea Agent。
你的职责是基于知识内容提出多样、有效、可执行的出题方向。`

interface IdeaAgentParams {
  topic: string
  preference?: string
  knowledgeContext?: string
  existingConcentrations: string[]
  numIdeas: number
  difficulty?: Difficulty
  questionType?: DeepTutorQuestionType
}

export class IdeaAgent {
  /**
   * 生成题目模板
   */
  async process(params: IdeaAgentParams): Promise<QuestionTemplate[]> {
    const {
      topic,
      preference = '',
      knowledgeContext = '',
      existingConcentrations,
      numIdeas,
      difficulty,
      questionType
    } = params

    const userPrompt = this.buildPrompt({
      topic,
      preference,
      knowledgeContext,
      existingConcentrations,
      numIdeas,
      difficulty,
      questionType
    })

    const response = await callLLM({
      systemPrompt: IDEA_AGENT_SYSTEM,
      userPrompt
    })

    const parsed = parseJSONResponse<IdeaAgentResponse>(response)
    if (!parsed?.ideas) {
      throw new Error('Failed to parse IdeaAgent response')
    }

    return parsed.ideas.map((idea) => ({
      question_id: idea.idea_id,
      concentration: idea.concentration,
      question_type: idea.question_type,
      difficulty: idea.difficulty,
      source: 'custom' as const,
      rationale: idea.rationale
    }))
  }

  private buildPrompt(params: IdeaAgentParams): string {
    const {
      topic,
      preference,
      knowledgeContext,
      existingConcentrations,
      numIdeas,
      difficulty,
      questionType
    } = params

    let prompt = `主题：
${topic}

用户偏好：
${preference || '无'}

知识依据：
${knowledgeContext || '无'}

前几批已经使用过的考察点：
${existingConcentrations.length > 0 ? existingConcentrations.join(', ') : '无'}

请生成恰好 ${numIdeas} 个候选出题创意。
`

    if (difficulty) {
      prompt += `难度要求：${difficulty}\n`
    }

    if (questionType) {
      prompt += `题型要求：${questionType}\n`
    }

    prompt += `
question_type 只允许：choice / written / calculation

仅返回 JSON：
{
  "ideas": [
    {
      "idea_id": "idea_1",
      "concentration": "该题主要考察点",
      "question_type": "choice | written | calculation",
      "difficulty": "easy | medium | hard",
      "rationale": "该创意的价值"
    }
  ]
}`

    return prompt
  }
}
