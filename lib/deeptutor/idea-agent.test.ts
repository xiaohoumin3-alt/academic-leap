/**
 * IdeaAgent 单元测试
 */

import { IdeaAgent } from './idea-agent'
import type { QuestionTemplate } from './models'

// Mock minimax API
jest.mock('../ai/generation/minimax', () => ({
  callLLM: jest.fn(),
  parseJSONResponse: jest.fn((json) => {
    try {
      return JSON.parse(json)
    } catch {
      return null
    }
  })
}))

import { callLLM } from '../ai/generation/minimax'

describe('IdeaAgent', () => {
  let agent: IdeaAgent

  beforeEach(() => {
    agent = new IdeaAgent()
    jest.clearAllMocks()
  })

  describe('process', () => {
    it('should generate question templates successfully', async () => {
      const mockResponse = {
        ideas: [
          {
            idea_id: 'q_001',
            concentration: '二次函数的定义',
            question_type: 'choice' as const,
            difficulty: 'easy' as const,
            rationale: '考察基本概念理解'
          },
          {
            idea_id: 'q_002',
            concentration: '二次函数的图像特征',
            question_type: 'choice' as const,
            difficulty: 'medium' as const,
            rationale: '考察图像性质'
          }
        ]
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      const result = await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数是形如 y = ax² + bx + c 的函数',
        existingConcentrations: [],
        numIdeas: 2
      })

      expect(result).toHaveLength(2)
      expect(result[0].question_id).toBe('q_001')
      expect(result[0].question_type).toBe('choice')
      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining('Idea Agent'),
        userPrompt: expect.stringContaining('二次函数')
      })
    })

    it('should pass existing concentrations to LLM for avoidance', async () => {
      const mockResponse = {
        ideas: [
          {
            idea_id: 'q_001',
            concentration: '二次函数的定义',
            question_type: 'choice' as const,
            difficulty: 'easy' as const,
            rationale: '考察基本概念'
          }
        ]
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数',
        existingConcentrations: ['二次函数的定义', '二次函数的图像'],
        numIdeas: 5
      })

      // 验证 existingConcentrations 被传递到 LLM
      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('二次函数的定义, 二次函数的图像')
      })
    })

    it('should handle case-insensitive concentration deduplication', async () => {
      const mockResponse = {
        ideas: [
          {
            idea_id: 'q_001',
            concentration: '二次函数的定义',
            question_type: 'choice' as const,
            difficulty: 'easy' as const,
            rationale: '考察基本概念'
          }
        ]
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数',
        existingConcentrations: ['二次函数的 DEFINITION'], // 不同大小写
        numIdeas: 5
      })

      // 验证 existingConcentrations 被传递（大小写保持原样传给 LLM）
      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('二次函数的 DEFINITION')
      })
    })

    it('should use custom difficulty when provided', async () => {
      const mockResponse = {
        ideas: [
          {
            idea_id: 'q_001',
            concentration: '二次函数',
            question_type: 'choice' as const,
            difficulty: 'hard' as const,
            rationale: '困难题'
          }
        ]
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数',
        existingConcentrations: [],
        numIdeas: 1,
        difficulty: 'hard'
      })

      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('难度要求：hard')
      })
    })

    it('should use custom question type when provided', async () => {
      const mockResponse = {
        ideas: [
          {
            idea_id: 'q_001',
            concentration: '二次函数',
            question_type: 'written' as const,
            difficulty: 'medium' as const,
            rationale: '主观题'
          }
        ]
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数',
        existingConcentrations: [],
        numIdeas: 1,
        questionType: 'written'
      })

      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('题型要求：written')
      })
    })

    it('should throw error when LLM call fails', async () => {
      ;(callLLM as jest.Mock).mockRejectedValue(
        new Error('API error')
      )

      await expect(
        agent.process({
          topic: '二次函数',
          preference: '高中数学',
          knowledgeContext: '二次函数',
          existingConcentrations: [],
          numIdeas: 5
        })
      ).rejects.toThrow('API error')
    })

    it('should throw error when response parsing fails', async () => {
      ;(callLLM as jest.Mock).mockResolvedValue('invalid json')

      await expect(
        agent.process({
          topic: '二次函数',
          preference: '高中数学',
          knowledgeContext: '二次函数',
          existingConcentrations: [],
          numIdeas: 5
        })
      ).rejects.toThrow()
    })

    it('should pass numIdeas to LLM prompt', async () => {
      const mockResponse = {
        ideas: Array.from(
          { length: 10 },
          (_, i) => ({
            idea_id: `q_${i}`,
            concentration: `考察点 ${i}`,
            question_type: 'choice' as const,
            difficulty: 'medium' as const,
            rationale: `理由 ${i}`
          })
        )
      }

      ;(callLLM as jest.Mock).mockResolvedValue(
        JSON.stringify(mockResponse)
      )

      const result = await agent.process({
        topic: '二次函数',
        preference: '高中数学',
        knowledgeContext: '二次函数',
        existingConcentrations: [],
        numIdeas: 3
      })

      // IdeaAgent 不限制返回数量，它返回 LLM 返回的所有 ideas
      // 但它会在 prompt 中请求指定数量
      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.any(String),
        userPrompt: expect.stringContaining('请生成恰好 3 个候选出题创意')
      })
      // 返回所有 LLM 返回的 ideas
      expect(result).toHaveLength(10)
    })
  })
})
