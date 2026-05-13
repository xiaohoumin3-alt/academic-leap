/**
 * Generator 单元测试
 */

import { Generator } from './generator'
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

describe('Generator', () => {
  let generator: Generator

  beforeEach(() => {
    generator = new Generator()
    jest.clearAllMocks()
  })

  describe('process', () => {
    const mockTemplate: QuestionTemplate = {
      question_id: 'q_001',
      concentration: '二次函数的开口方向',
      question_type: 'choice',
      difficulty: 'easy',
      source: 'custom',
      rationale: '考察基本概念'
    }

    it('should generate choice question successfully', async () => {
      const mockQA = {
        question: '二次函数 y = ax² 的开口方向由什么决定？',
        question_type: 'choice',
        options: {
          A: 'a 的符号',
          B: 'b 的符号',
          C: 'c 的符号',
          D: 'Δ 的符号'
        },
        correct_answer: 'A',
        explanation: '二次项系数 a 决定开口方向'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      const result = await generator.process({
        template: mockTemplate,
        topic: '二次函数',
        knowledgeContext: '二次函数是形如 y = ax² + bx + c 的函数',
        previousQuestions: []
      })

      expect(result.question).toContain('开口方向')
      expect(result.question_type).toBe('choice')
      expect(result.options).toBeDefined()
      expect(result.options?.A).toBe('a 的符号')
      expect(result.correct_answer).toBe('A')
      expect(result.concentration).toBe(mockTemplate.concentration)
      expect(result.difficulty).toBe(mockTemplate.difficulty)
    })

    it('should generate written question successfully', async () => {
      const writtenTemplate: QuestionTemplate = {
        ...mockTemplate,
        question_type: 'written'
      }

      const mockQA = {
        question: '求解方程 x² - 5x + 6 = 0',
        question_type: 'written',
        correct_answer: 'x₁ = 2, x₂ = 3',
        explanation: '使用因式分解：(x-2)(x-3)=0'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      const result = await generator.process({
        template: writtenTemplate,
        topic: '一元二次方程',
        knowledgeContext: '因式分解法',
        previousQuestions: []
      })

      expect(result.question_type).toBe('written')
      expect(result.options).toBeUndefined()
      expect(result.correct_answer).toBe('x₁ = 2, x₂ = 3')
    })

    it('should generate calculation question successfully', async () => {
      const calcTemplate: QuestionTemplate = {
        ...mockTemplate,
        question_type: 'calculation'
      }

      const mockQA = {
        question: '计算 (2x + 3)²',
        question_type: 'calculation',
        correct_answer: '4x² + 12x + 9',
        explanation: '使用完全平方公式'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      const result = await generator.process({
        template: calcTemplate,
        topic: '代数式运算',
        knowledgeContext: '完全平方公式',
        previousQuestions: []
      })

      expect(result.question_type).toBe('calculation')
      expect(result.correct_answer).toBe('4x² + 12x + 9')
    })

    it('should include previous questions in prompt', async () => {
      const mockQA = {
        question: '新问题',
        question_type: 'choice',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        correct_answer: 'A',
        explanation: '解释'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      await generator.process({
        template: mockTemplate,
        topic: '二次函数',
        knowledgeContext: '上下文',
        previousQuestions: ['问题1', '问题2']
      })

      expect(callLLM).toHaveBeenCalledWith({
        systemPrompt: expect.stringContaining('Generator'),
        userPrompt: expect.stringContaining('问题1')
      })
    })

    it('should validate choice question has 4 options', async () => {
      const mockQA = {
        question: '问题',
        question_type: 'choice',
        options: {
          A: 'A',
          B: 'B',
          C: 'C',
          D: 'D'
        },
        correct_answer: 'A',
        explanation: '解释'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      const result = await generator.process({
        template: mockTemplate,
        topic: '二次函数',
        knowledgeContext: '上下文',
        previousQuestions: []
      })

      expect(result.options).toBeDefined()
      expect(Object.keys(result.options!)).toHaveLength(4)
      expect(['A', 'B', 'C', 'D'].every(k => k in result.options!)).toBe(true)
    })

    it('should validate correct_answer is valid option', async () => {
      const mockQA = {
        question: '问题',
        question_type: 'choice',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        correct_answer: 'B',
        explanation: '解释'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      const result = await generator.process({
        template: mockTemplate,
        topic: '二次函数',
        knowledgeContext: '上下文',
        previousQuestions: []
      })

      expect(['A', 'B', 'C', 'D']).toContain(result.correct_answer)
    })

    it('should throw error when LLM call fails', async () => {
      ;(callLLM as jest.Mock).mockRejectedValue(new Error('API error'))

      await expect(
        generator.process({
          template: mockTemplate,
          topic: '二次函数',
          knowledgeContext: '上下文',
          previousQuestions: []
        })
      ).rejects.toThrow('API error')
    })

    it('should throw error when response parsing fails', async () => {
      ;(callLLM as jest.Mock).mockResolvedValue('invalid json')

      await expect(
        generator.process({
          template: mockTemplate,
          topic: '二次函数',
          knowledgeContext: '上下文',
          previousQuestions: []
        })
      ).rejects.toThrow()
    })

    it('should throw error when question_type mismatch', async () => {
      const mockQA = {
        question: '问题',
        question_type: 'written', // 不匹配
        correct_answer: '答案',
        explanation: '解释'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      await expect(
        generator.process({
          template: mockTemplate, // choice
          topic: '二次函数',
          knowledgeContext: '上下文',
          previousQuestions: []
        })
      ).rejects.toThrow()
    })

    it('should throw error when choice question missing options', async () => {
      const mockQA = {
        question: '问题',
        question_type: 'choice',
        // 缺少 options
        correct_answer: 'A',
        explanation: '解释'
      }

      ;(callLLM as jest.Mock).mockResolvedValue(JSON.stringify(mockQA))

      await expect(
        generator.process({
          template: mockTemplate,
          topic: '二次函数',
          knowledgeContext: '上下文',
          previousQuestions: []
        })
      ).rejects.toThrow()
    })
  })
})
