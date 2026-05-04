/**
 * Phase 2: 多模型支持 - Model Adapter测试
 *
 * User Journey: As a 开发者，我需要统一的模型调用接口支持多个AI提供商
 *
 * 测试覆盖：
 * 1. 多模型适配器
 * 2. Claude模型支持（Haiku, Sonnet, Opus）
 * 3. 模型选择策略
 * 4. 成本优化（简单任务用Haiku）
 */

import { ModelAdapter, ModelType, ModelProvider } from '@/lib/ai/model-adapter';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ModelAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Claude模型支持', () => {
    it('应该支持Claude Haiku快速模型', async () => {
      const adapter = new ModelAdapter({
        model: 'claude-haiku-4.5',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Test response' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      });

      const result = await adapter.generate('Hello');

      expect(result.content).toBe('Test response');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('anthropic.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key',
            'anthropic-version': '2023-06-01'
          })
        })
      );
    });

    it('应该支持Claude Sonnet平衡模型', async () => {
      const adapter = new ModelAdapter({
        model: 'claude-sonnet-4.6',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      });

      const result = await adapter.generate('Test');

      expect(result.content).toBe('Response');
    });

    it('应该支持Claude Opus深度推理模型', async () => {
      const adapter = new ModelAdapter({
        model: 'claude-opus-4.7',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Deep reasoning' }],
          usage: { input_tokens: 100, output_tokens: 200 }
        })
      });

      const result = await adapter.generate('Complex task');

      expect(result.content).toBe('Deep reasoning');
    });
  });

  describe('模型选择策略', () => {
    it('简单任务应选择Haiku（成本优化）', () => {
      const model = ModelAdapter.selectModelForTask({
        complexity: 'simple',
        requiresReasoning: false
      });

      expect(model).toBe('claude-haiku-4.5');
    });

    it('复杂编码任务应选择Sonnet', () => {
      const model = ModelAdapter.selectModelForTask({
        complexity: 'medium',
        requiresReasoning: true,
        taskType: 'coding'
      });

      expect(model).toBe('claude-sonnet-4.6');
    });

    it('深度分析任务应选择Opus', () => {
      const model = ModelAdapter.selectModelForTask({
        complexity: 'high',
        requiresReasoning: true,
        taskType: 'analysis'
      });

      expect(model).toBe('claude-opus-4.7');
    });
  });

  describe('多提供商支持', () => {
    it('应该支持OpenAI GPT模型', async () => {
      const adapter = new ModelAdapter({
        model: 'gpt-4o',
        provider: 'openai',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'GPT response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      });

      const result = await adapter.generate('Test');

      expect(result.content).toBe('GPT response');
    });

    it('应该支持Gemini模型', async () => {
      const adapter = new ModelAdapter({
        model: 'gemini-2.5-flash',
        provider: 'google',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }
        })
      });

      const result = await adapter.generate('Test');

      expect(result.content).toBe('Gemini response');
    });
  });

  describe('成本追踪', () => {
    it('应该追踪token使用情况', async () => {
      const adapter = new ModelAdapter({
        model: 'claude-haiku-4.5',
        apiKey: 'test-key'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 1000, output_tokens: 500 }
        })
      });

      const result = await adapter.generate('Test');

      expect(result.usage.promptTokens).toBe(1000);
      expect(result.usage.completionTokens).toBe(500);
    });
  });
});
