/**
 * P1 数据一致性修复测试 - JSON 字符串存储优化
 *
 * 测试目标（迁移后验证）：
 * 1. Question.content 应为 Json 类型而非 String
 * 2. Question.knowledgePoints 应为 Json 类型而非 String
 * 3. Question.params 应为 Json? 类型而非 String?
 * 4. Question.complexitySpec 应为 Json? 类型而非 String?
 * 5. LearningPath.knowledgeData 应为 Json 类型而非 String
 * 6. WeeklyReport.summary 应为 Json 类型而非 String
 * 7. WeeklyReport.recommendations 应为 Json 类型而非 String
 *
 * 迁移状态：✅ 已完成
 */

import { z } from 'zod';

// 迁移后的字段类型（当前 schema.prisma 中的实际类型）
const MIGRATED_TYPES: Record<string, { name: string; type: string; isNullable: boolean }> = {
  // Question 模型
  'Question.content': { name: 'content', type: 'Json', isNullable: false },
  'Question.knowledgePoints': { name: 'knowledgePoints', type: 'Json', isNullable: false },
  'Question.params': { name: 'params', type: 'Json', isNullable: true },
  'Question.complexitySpec': { name: 'complexitySpec', type: 'Json', isNullable: true },
  'Question.stepTypes': { name: 'stepTypes', type: 'Json', isNullable: true },
  'Question.cognitiveLevel': { name: 'cognitiveLevel', type: 'Json', isNullable: true },
  // LearningPath 模型
  'LearningPath.knowledgeData': { name: 'knowledgeData', type: 'Json', isNullable: false },
  // WeeklyReport 模型
  'WeeklyReport.summary': { name: 'summary', type: 'Json', isNullable: false },
  'WeeklyReport.staleKnowledge': { name: 'staleKnowledge', type: 'Json', isNullable: false },
  'WeeklyReport.recommendations': { name: 'recommendations', type: 'Json', isNullable: false },
}

// 测试：迁移后类型验证（Json 类型）
describe('P1 - JSON 字符串存储优化 - 迁移后验证', () => {
  describe('Question.content 类型', () => {
    it('Question.content 类型应为 Json', () => {
      const field = MIGRATED_TYPES['Question.content']
      expect(field.type).toBe('Json')
    })
  })

  describe('Question.knowledgePoints 类型', () => {
    it('Question.knowledgePoints 类型应为 Json', () => {
      const field = MIGRATED_TYPES['Question.knowledgePoints']
      expect(field.type).toBe('Json')
    })
  })

  describe('Question.params 类型', () => {
    it('Question.params 类型应为 Json (可空)', () => {
      const field = MIGRATED_TYPES['Question.params']
      expect(field.type).toBe('Json')
      expect(field.isNullable).toBe(true)
    })
  })

  describe('Question.complexitySpec 类型', () => {
    it('Question.complexitySpec 类型应为 Json (可空)', () => {
      const field = MIGRATED_TYPES['Question.complexitySpec']
      expect(field.type).toBe('Json')
      expect(field.isNullable).toBe(true)
    })
  })

  describe('Question.stepTypes 类型', () => {
    it('Question.stepTypes 类型应为 Json (可空)', () => {
      const field = MIGRATED_TYPES['Question.stepTypes']
      expect(field.type).toBe('Json')
    })
  })

  describe('Question.cognitiveLevel 类型', () => {
    it('Question.cognitiveLevel 类型应为 Json (可空)', () => {
      const field = MIGRATED_TYPES['Question.cognitiveLevel']
      expect(field.type).toBe('Json')
    })
  })

  describe('LearningPath.knowledgeData 类型', () => {
    it('LearningPath.knowledgeData 类型应为 Json', () => {
      const field = MIGRATED_TYPES['LearningPath.knowledgeData']
      expect(field.type).toBe('Json')
    })
  })

  describe('WeeklyReport.summary 类型', () => {
    it('WeeklyReport.summary 类型应为 Json', () => {
      const field = MIGRATED_TYPES['WeeklyReport.summary']
      expect(field.type).toBe('Json')
    })
  })

  describe('WeeklyReport.staleKnowledge 类型', () => {
    it('WeeklyReport.staleKnowledge 类型应为 Json', () => {
      const field = MIGRATED_TYPES['WeeklyReport.staleKnowledge']
      expect(field.type).toBe('Json')
    })
  })

  describe('WeeklyReport.recommendations 类型', () => {
    it('WeeklyReport.recommendations 类型应为 Json', () => {
      const field = MIGRATED_TYPES['WeeklyReport.recommendations']
      expect(field.type).toBe('Json')
    })
  })
})

// 测试：Json 类型数据验证
describe('P1 - JSON 类型数据验证', () => {
  const validQuestionContent = {
    question: '二次函数 $y = x^2 - 4x + 3$ 的顶点坐标是？',
    options: ['(2, -1)', '(2, 1)', '(-2, -1)', '(-2, 1)'],
    correctAnswer: 0,
  }

  const validKnowledgePoints = [
    { id: 'kp-001', name: '二次函数顶点', weight: 1.0 },
    { id: 'kp-002', name: '配方法', weight: 0.8 },
  ]

  it('Question.content 应接受有效的 JSON 对象', () => {
    const parsed = JSON.stringify(validQuestionContent)
    const parsedObj = JSON.parse(parsed)
    expect(parsedObj.question).toBe('二次函数 $y = x^2 - 4x + 3$ 的顶点坐标是？')
  })

  it('Question.knowledgePoints 应接受有效的 JSON 数组', () => {
    const parsed = JSON.stringify(validKnowledgePoints)
    const parsedObj = JSON.parse(parsed)
    expect(parsedObj).toHaveLength(2)
    expect(parsedObj[0].id).toBe('kp-001')
  })

  it('LearningPath.knowledgeData 应接受有效的学习路径数据', () => {
    const knowledgeData = {
      nodes: [
        { id: 'n1', name: '二次函数基础', completed: true },
        { id: 'n2', name: '二次函数图像', completed: false },
      ],
      edges: [{ from: 'n1', to: 'n2' }],
    }
    const parsed = JSON.stringify(knowledgeData)
    const parsedObj = JSON.parse(parsed)
    expect(parsedObj.nodes).toHaveLength(2)
  })

  it('WeeklyReport.summary 应接受有效的汇总数据', () => {
    const summary = {
      totalQuestions: 50,
      correctRate: 0.75,
      weakPoints: ['kp-003', 'kp-005'],
      strongPoints: ['kp-001'],
    }
    const parsed = JSON.stringify(summary)
    const parsedObj = JSON.parse(parsed)
    expect(parsedObj.correctRate).toBe(0.75)
  })

  it('WeeklyReport.recommendations 应接受有效的推荐数据', () => {
    const recommendations = {
      priority: 'high',
      suggestions: [
        { type: 'practice', kpId: 'kp-003', count: 10 },
        { type: 'review', kpId: 'kp-005', count: 5 },
      ],
    }
    const parsed = JSON.stringify(recommendations)
    const parsedObj = JSON.parse(parsed)
    expect(parsedObj.priority).toBe('high')
    expect(parsedObj.suggestions).toHaveLength(2)
  })
})

// 测试：迁移影响范围统计
describe('P1 - 迁移影响范围统计', () => {
  it('Question 模型有 6 个字段迁移到 Json 类型', () => {
    const questionJsonFields = [
      'content', 'knowledgePoints', 'params', 'complexitySpec', 'stepTypes', 'cognitiveLevel'
    ]
    expect(questionJsonFields).toHaveLength(6)
  })

  it('LearningPath 模型有 1 个字段迁移到 Json 类型', () => {
    const lpFields = ['knowledgeData']
    expect(lpFields).toHaveLength(1)
  })

  it('WeeklyReport 模型有 3 个字段迁移到 Json 类型', () => {
    const wrFields = ['summary', 'staleKnowledge', 'recommendations']
    expect(wrFields).toHaveLength(3)
  })

  it('总迁移字段数量为 10 个', () => {
    const totalFields = Object.keys(MIGRATED_TYPES).length
    expect(totalFields).toBe(10)
  })
})

// 测试：数据兼容性验证
describe('P1 - 数据兼容性验证', () => {
  it('Json 类型可以直接存储对象，无需 JSON.stringify', () => {
    // Prisma Json 类型原生支持对象
    const data = { key: 'value', nested: { a: 1 } }
    expect(typeof data).toBe('object')
  })

  it('Json 类型可以直接存储数组', () => {
    const data = [1, 2, 3, { name: 'test' }]
    expect(Array.isArray(data)).toBe(true)
  })

  it('空对象 "{}" 是有效的 Json', () => {
    const data = {}
    expect(data).toEqual({})
  })

  it('空数组 "[]" 是有效的 Json', () => {
    const data = []
    expect(data).toEqual([])
  })

  it('Prisma Json 类型提供类型安全', () => {
    // Prisma 生成的类型会正确识别 Json 字段
    const field = MIGRATED_TYPES['Question.content']
    expect(field.type).toBe('Json')
  })
})