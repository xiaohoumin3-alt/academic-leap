/**
 * models 单元测试
 * 测试类型定义和验证函数
 */

import type { QuestionTemplate, QAPair, GenerationRequest } from './models'

describe('DeepTutor Models', () => {
  describe('QuestionTemplate', () => {
    it('should accept valid question template', () => {
      const template: QuestionTemplate = {
        question_id: 'q_001',
        concentration: '二次函数的图像特征',
        question_type: 'choice',
        difficulty: 'easy',
        source: 'custom',
        rationale: '考察基本概念'
      }

      expect(template.question_id).toMatch(/^q_/)
      expect(['choice', 'written', 'calculation']).toContain(template.question_type)
      expect(['easy', 'medium', 'hard']).toContain(template.difficulty)
    })

    it('should accept all valid question types', () => {
      const types: Array<QuestionTemplate['question_type']> = ['choice', 'written', 'calculation']

      types.forEach((type) => {
        const template: QuestionTemplate = {
          question_id: `q_${type}`,
          concentration: '测试',
          question_type: type,
          difficulty: 'medium',
          source: 'custom'
        }
        expect(template.question_type).toBe(type)
      })
    })

    it('should accept all valid difficulty levels', () => {
      const difficulties: Array<QuestionTemplate['difficulty']> = ['easy', 'medium', 'hard']

      difficulties.forEach((difficulty) => {
        const template: QuestionTemplate = {
          question_id: `q_${difficulty}`,
          concentration: '测试',
          question_type: 'choice',
          difficulty,
          source: 'custom'
        }
        expect(template.difficulty).toBe(difficulty)
      })
    })
  })

  describe('QAPair', () => {
    it('should accept valid choice QAPair', () => {
      const qa: QAPair = {
        question_id: 'q_001',
        question: '二次函数的开口方向由什么决定？',
        question_type: 'choice',
        options: {
          A: 'a 的符号',
          B: 'b 的符号',
          C: 'c 的符号',
          D: 'Δ 的符号'
        },
        correct_answer: 'A',
        explanation: '二次项系数 a 决定开口方向',
        concentration: '二次函数的图像特征',
        difficulty: 'easy'
      }

      expect(qa.question_type).toBe('choice')
      expect(qa.options).toBeDefined()
      expect(qa.correct_answer).toMatch(/^[ABCD]$/)
    })

    it('should accept valid written QAPair without options', () => {
      const qa: QAPair = {
        question_id: 'q_002',
        question: '求解方程 x² - 5x + 6 = 0',
        question_type: 'written',
        correct_answer: 'x₁ = 2, x₂ = 3',
        explanation: '使用因式分解法',
        concentration: '一元二次方程的求解',
        difficulty: 'medium'
      }

      expect(qa.question_type).toBe('written')
      expect(qa.options).toBeUndefined()
    })

    it('should accept valid calculation QAPair', () => {
      const qa: QAPair = {
        question_id: 'q_003',
        question: '计算 (2x + 3)²',
        question_type: 'calculation',
        correct_answer: '4x² + 12x + 9',
        explanation: '使用完全平方公式',
        concentration: '代数式运算',
        difficulty: 'medium'
      }

      expect(qa.question_type).toBe('calculation')
    })
  })

  describe('GenerationRequest', () => {
    it('should accept valid request with all fields', () => {
      const request: GenerationRequest = {
        mode: 'custom',
        topic: '一元二次方程的求解',
        preference: '高中数学，侧重基础概念',
        knowledgeContext: '一元二次方程是形如 ax² + bx + c = 0 的方程',
        count: 5,
        difficulty: 'medium',
        questionType: 'choice'
      }

      expect(request.mode).toBe('custom')
      expect(request.count).toBe(5)
      expect(request.difficulty).toBe('medium')
    })

    it('should accept valid request with minimal fields', () => {
      const request: GenerationRequest = {
        mode: 'custom',
        topic: '二次函数',
        count: 3
      }

      expect(request.topic).toBeDefined()
      expect(request.count).toBe(3)
    })

    it('should require topic', () => {
      // TypeScript 类型系统在编译时验证必需字段
      // 这个测试验证类型定义正确性
      const incompleteRequest = {
        mode: 'custom' as const,
        count: 3
        // 缺少 topic - TypeScript 应该报错
      }

      // @ts-expect-error - 故意缺少必需字段来验证类型系统
      const requestWithMissing: GenerationRequest = incompleteRequest

      expect(requestWithMissing.mode).toBe('custom')
      expect(requestWithMissing.count).toBe(3)
      // topic 是 undefined，但 TypeScript 允许通过类型断言
    })
  })
})
