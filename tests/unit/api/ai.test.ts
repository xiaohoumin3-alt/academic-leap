/**
 * AI API 测试
 */

import { POST } from '@/app/api/ai/generate/route';
import { GET } from '@/app/api/ai/models/route';
import { NextRequest } from 'next/server';

// Mock ModelAdapter
jest.mock('@/lib/ai/model-adapter', () => ({
  ModelAdapter: class MockModelAdapter {
    config: any;
    constructor(config: any) {
      this.config = config;
    }
    async generate(prompt: string) {
      return {
        content: `Generated: ${prompt}`,
        usage: { promptTokens: 10, completionTokens: 20 }
      };
    }
    static selectModelForTask(complexity: any) {
      return 'claude-sonnet-4.6';
    }
    static getAvailableModels() {
      return [
        { model: 'claude-haiku-4.5', provider: 'anthropic', description: 'Fast' },
        { model: 'claude-sonnet-4.6', provider: 'anthropic', description: 'Balanced' }
      ];
    }
  }
}));

describe('/api/ai/models', () => {
  it('应该返回所有可用模型', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty('model');
    expect(data.data[0]).toHaveProperty('provider');
    expect(data.data[0]).toHaveProperty('description');
  });
});

describe('/api/ai/generate', () => {
  it('应该使用指定模型生成内容', async () => {
    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
        model: 'claude-haiku-4.5'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.content).toBe('Generated: Test prompt');
    expect(data.data.model).toBe('claude-haiku-4.5');
    expect(data.data.usage).toHaveProperty('promptTokens');
    expect(data.data.usage).toHaveProperty('completionTokens');
  });

  it('应该根据任务复杂度自动选择模型', async () => {
    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Complex task',
        taskComplexity: {
          complexity: 'simple',
          requiresReasoning: false
        }
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.model).toBe('claude-sonnet-4.6');
  });

  it('缺少prompt时应该返回400错误', async () => {
    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(response.status).toBe(400);
  });

  it('默认应该使用Sonnet模型', async () => {
    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Default test'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.model).toBe('claude-sonnet-4.6');
  });
});
