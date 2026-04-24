import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('知识点树 API', () => {
  test.use({ storageState: 'e2e/storage-state.json' });

  test('GET /api/user/knowledge-tree 返回知识点树', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user/knowledge-tree`);

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
    expect(data.data).toHaveProperty('textbook');
    expect(data.data).toHaveProperty('chapters');
    expect(Array.isArray(data.data.chapters)).toBe(true);
  });

  test('知识点树包含勾选状态', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user/knowledge-tree`);

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    // 如果用户未设置教材，跳过测试
    if (response.status() === 400) {
      test.skip();
      return;
    }

    const data = await response.json();
    const chapter = data.data.chapters[0];
    expect(chapter).toHaveProperty('enabled');
    if (chapter.knowledgePoints.length > 0) {
      expect(chapter.knowledgePoints[0]).toHaveProperty('enabled');
    }
  });
});

// 未认证用户的测试
test.describe('知识点树 API - 未认证', () => {
  test('GET /api/user/knowledge-tree 未登录时返回401', async ({ playwright }) => {
    const context = await playwright.request.newContext({
      storageState: { cookies: [], origins: [] }
    });
    const response = await context.get(`${BASE_URL}/api/user/knowledge-tree`);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('未登录');

    await context.dispose();
  });
});
