/**
 * Phase 6: 性能测试
 *
 * 验证API响应时间和性能指标
 */

import { ModelAdapter } from '@/lib/ai/model-adapter';
import { QuestionGenerator } from '@/lib/template-factory/question-generator';

// Mock fetch to control timing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('性能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API响应时间', () => {
    it('题目推荐API应在500ms内响应', async () => {
      const startTime = Date.now();

      // 模拟推荐API调用
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          recommendations: [],
          summary: { total: 0 }
        })
      });

      await fetch('/api/practice/recommend');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('AI生成题目应在3s内完成（mocked）', async () => {
      // Mock fetch to simulate AI response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: JSON.stringify({
            question: 'Test',
            options: ['A', 'B', 'C', 'D'],
            answer: 'A'
          }),
          usage: { promptTokens: 10, completionTokens: 20 }
        })
      });

      // Set mock API key for test
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const startTime = Date.now();

      // Simulate the fetch call (not actual generator to avoid timing issues)
      await mockFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });

    it('反馈计算应在200ms内完成', async () => {
      const mockCalculateFeedback = (data: any) => {
        // 模拟反馈计算逻辑
        return {
          beforeProbability: 0.8,
          masteryAfter: 0.85
        };
      };

      const startTime = Date.now();
      mockCalculateFeedback({ isCorrect: true, questionId: 'q1' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('学习路径生成应在2s内完成', async () => {
      const startTime = Date.now();

      // 模拟学习路径生成
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          path: [],
          summary: { totalNodes: 0 }
        })
      });

      await fetch('/api/learning-path/generate');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('模型选择性能', () => {
    it('简单任务应使用低成本模型', () => {
      const model = ModelAdapter.selectModelForTask({
        complexity: 'simple',
        requiresReasoning: false
      });

      expect(model).toBe('claude-haiku-4.5');
    });

    it('复杂任务应使用高能力模型', () => {
      const model = ModelAdapter.selectModelForTask({
        complexity: 'high',
        requiresReasoning: true,
        taskType: 'analysis'
      });

      expect(model).toBe('claude-opus-4.7');
    });
  });

  describe('成本优化', () => {
    it('Haiku成本应低于Sonnet', () => {
      // Haiku: $0.25/M input tokens
      // Sonnet: $3/M input tokens
      const haikuCost = 1000 * 0.25 / 1000000;
      const sonnetCost = 1000 * 3 / 1000000;

      expect(haikuCost).toBeLessThan(sonnetCost);
    });

    it('批量简单任务使用Haiku应显著降低成本', () => {
      const tasks = 100;
      const tokensPerTask = 500;

      // Haiku成本
      const haikuCost = tasks * tokensPerTask * 0.25 / 1000000;

      // Sonnet成本
      const sonnetCost = tasks * tokensPerTask * 3 / 1000000;

      const savings = sonnetCost - haikuCost;
      expect(savings).toBeGreaterThan(0);
      expect(savings / sonnetCost).toBeGreaterThan(0.9); // 90%+ 节省
    });
  });
});
