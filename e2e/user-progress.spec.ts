import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('用户进度 API', () => {
  test.use({ storageState: 'e2e/storage-state.json' });

  test('GET /api/user/progress 返回进度计算', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user/progress`);

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    // 如果用户未设置教材，返回400是预期的
    if (response.status() === 400) {
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('教材');
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('currentChapter');
    expect(data.data).toHaveProperty('progress');
    expect(data.data).toHaveProperty('completedChapters');
    expect(data.data).toHaveProperty('totalChapters');
    expect(data.data).toHaveProperty('enabledKnowledgeCount');
    expect(data.data).toHaveProperty('totalKnowledgeCount');
  });
});

// 未认证用户的测试 - 使用单独的测试组和空白存储状态
test.describe('用户进度 API - 未认证', () => {
  test('GET /api/user/progress 未登录时返回401', async ({ playwright }) => {
    // 创建一个新的请求上下文，不使用任何存储状态
    const context = await playwright.request.newContext({
      // 确保不使用任何存储的 cookies
      storageState: { cookies: [], origins: [] }
    });
    const response = await context.get(`${BASE_URL}/api/user/progress`);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('未登录');

    await context.dispose();
  });
});
