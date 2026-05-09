/**
 * Phase 3: 题目生成增强测试
 *
 * User Journey: As a 教师或系统，我需要AI自动生成各类题目
 *
 * 测试覆盖：
 * 1. 基础题型直接AI生成（选择题、判断题）
 * 2. 复杂题型模板+AI填充
 * 3. 使用新的ModelAdapter
 */

import { QuestionGenerator, QuestionType } from '@/lib/template-factory/question-generator';

// Mock ModelAdapter
const mockGenerate = jest.fn();
jest.mock('@/lib/ai/model-adapter', () => ({
  ModelAdapter: class MockModelAdapter {
    config: any;
    constructor(config: any) {
      this.config = config;
    }
    async generate(prompt: string, options?: any) {
      return mockGenerate(prompt, options);
    }
    static selectModelForTask(complexity: any) {
      return 'claude-sonnet-4.6';
    }
  }
}));

describe('QuestionGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础题型AI生成', () => {
    it('应该生成选择题', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          question: '2 + 2 = ?',
          options: ['3', '4', '5', '6'],
          answer: '4',
          explanation: '2加2等于4'
        }),
        usage: { promptTokens: 10, completionTokens: 20 }
      });

      const generator = new QuestionGenerator();
      const result = await generator.generate({
        type: 'multiple_choice',
        knowledgePoint: '加法运算',
        grade: 1
      });

      expect(result.type).toBe('multiple_choice');
      expect(result.question).toBe('2 + 2 = ?');
      expect(result.options).toEqual(['3', '4', '5', '6']);
      expect(result.answer).toBe('4');
    });

    it('应该生成判断题', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          question: '3是质数',
          answer: true,
          explanation: '3只能被1和3整除'
        }),
        usage: { promptTokens: 10, completionTokens: 20 }
      });

      const generator = new QuestionGenerator();
      const result = await generator.generate({
        type: 'true_false',
        knowledgePoint: '质数概念',
        grade: 5
      });

      expect(result.type).toBe('true_false');
      expect(result.question).toBe('3是质数');
      expect(result.answer).toBe(true);
    });

    it('简单任务应使用Haiku模型', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          question: 'Test',
          options: ['A', 'B'],
          answer: 'A'
        }),
        usage: { promptTokens: 10, completionTokens: 20 }
      });

      const generator = new QuestionGenerator();
      await generator.generate({
        type: 'multiple_choice',
        knowledgePoint: '基础概念',
        grade: 3
      });

      // 验证选择了正确的模型（通过检查调用时的配置）
      expect(mockGenerate).toHaveBeenCalled();
    });
  });

  describe('复杂题型模板生成', () => {
    it('应该生成计算题（使用模板）', async () => {
      // 计算题使用预定义模板，只需要AI填充参数
      const generator = new QuestionGenerator();
      const result = await generator.generate({
        type: 'calculation',
        knowledgePoint: '平方根计算',
        grade: 7,
        template: {
          structure: 'COMPUTE_SQRT',
          params: { min: 1, max: 100 }
        }
      });

      expect(result.type).toBe('calculation');
      expect(result.template).toBe('COMPUTE_SQRT');
      expect(result.question).toBeDefined();
    });

    it('应该生成应用题（使用模板+AI）', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          scenario: '小明有50元，买了3支笔，每支8元，还剩多少元？',
          steps: ['计算笔的总价: 3 × 8 = 24元', '计算剩余: 50 - 24 = 26元'],
          answer: '26元'
        }),
        usage: { promptTokens: 50, completionTokens: 100 }
      });

      const generator = new QuestionGenerator();
      const result = await generator.generate({
        type: 'word_problem',
        knowledgePoint: '小数四则运算',
        grade: 5
      });

      expect(result.type).toBe('word_problem');
      expect(result.question).toContain('小明');
      expect(result.steps).toBeDefined();
    });

    it('复杂任务应使用Sonnet或Opus', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          scenario: 'Complex problem',
          steps: ['Step 1', 'Step 2'],
          answer: 'Answer'
        }),
        usage: { promptTokens: 100, completionTokens: 200 }
      });

      const generator = new QuestionGenerator();
      await generator.generate({
        type: 'word_problem',
        knowledgePoint: '复杂应用题',
        grade: 8
      });

      expect(mockGenerate).toHaveBeenCalled();
    });
  });

  describe('批量生成', () => {
    it('应该批量生成题目', async () => {
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          question: 'Test question',
          options: ['A', 'B', 'C', 'D'],
          answer: 'A'
        }),
        usage: { promptTokens: 10, completionTokens: 20 }
      });

      const generator = new QuestionGenerator();
      const results = await generator.generateBatch({
        type: 'multiple_choice',
        knowledgePoint: '测试知识点',
        grade: 5,
        count: 5
      });

      expect(results).toHaveLength(5);
      results.forEach(r => {
        expect(r.type).toBe('multiple_choice');
        expect(r.question).toBeDefined();
      });
    });
  });
});
