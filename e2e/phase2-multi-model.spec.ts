/**
 * Phase 6: E2E测试 - 多模型支持和题目生成
 *
 * 测试AI模型调用和题目生成功能
 */

import { test, expect } from './fixtures';

test.describe('多模型支持', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应能获取可用模型列表', async ({ page }) => {
    // 调用模型列表API
    const response = await page.request.get('/api/ai/models');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data.length).toBeGreaterThan(0);

    // 验证返回的模型包含必要字段
    const firstModel = data.data[0];
    expect(firstModel).toHaveProperty('model');
    expect(firstModel).toHaveProperty('provider');
    expect(firstModel).toHaveProperty('description');
  });

  test('应能使用指定模型生成内容', async ({ page }) => {
    const response = await page.request.post('/api/ai/generate', {
      data: JSON.stringify({
        prompt: '生成一道简单加法题',
        model: 'claude-haiku-4.5'
      })
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('content');
    expect(data.data.model).toBe('claude-haiku-4.5');
    expect(data.data.usage).toHaveProperty('promptTokens');
    expect(data.data.usage).toHaveProperty('completionTokens');
  });

  test('应能根据任务复杂度自动选择模型', async ({ page }) => {
    // 简单任务应选择Haiku
    const simpleResponse = await page.request.post('/api/ai/generate', {
      data: JSON.stringify({
        prompt: '简单任务',
        taskComplexity: {
          complexity: 'simple',
          requiresReasoning: false
        }
      })
    });
    const simpleData = await simpleResponse.json();
    expect(simpleData.success).toBe(true);

    // 复杂任务应选择Sonnet或Opus
    const complexResponse = await page.request.post('/api/ai/generate', {
      data: JSON.stringify({
        prompt: '复杂分析任务',
        taskComplexity: {
          complexity: 'high',
          requiresReasoning: true,
          taskType: 'analysis'
        }
      })
    });
    const complexData = await complexResponse.json();
    expect(complexData.success).toBe(true);
  });
});

test.describe('题目生成增强', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('应能生成选择题', async ({ page }) => {
    const response = await page.request.post('/api/questions/generate', {
      data: JSON.stringify({
        type: 'multiple_choice',
        knowledgePoint: '加法运算',
        grade: 1
      })
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.type).toBe('multiple_choice');
    expect(data.data.question).toBeDefined();
    expect(data.data.options).toBeInstanceOf(Array);
    expect(data.data.options).toHaveLength(4);
  });

  test('应能生成判断题', async ({ page }) => {
    const response = await page.request.post('/api/questions/generate', {
      data: JSON.stringify({
        type: 'true_false',
        knowledgePoint: '质数概念',
        grade: 5
      })
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.type).toBe('true_false');
    expect(data.data.answer).toBeType('boolean');
  });

  test('应能批量生成题目', async ({ page }) => {
    const response = await page.request.post('/api/questions/generate-batch', {
      data: JSON.stringify({
        type: 'multiple_choice',
        knowledgePoint: '测试知识点',
        grade: 5,
        count: 5
      })
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(5);
    data.data.forEach((q: any) => {
      expect(q.type).toBe('multiple_choice');
    });
  });
});
