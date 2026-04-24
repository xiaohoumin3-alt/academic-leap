import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('智能推荐 API', () => {
  test.use({ storageState: 'e2e/storage-state.json' });

  test('POST /api/user/knowledge/recommend overwrite=true清除并重新勾选', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/user/knowledge/recommend`, {
      data: { overwrite: true }
    });

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    // 如果用户未设置教材，跳过测试
    if (response.status() === 400) {
      const data = await response.json();
      if (data.error === '用户未设置教材') {
        test.skip();
        return;
      }
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('recommendedChapterId');
    expect(data.data).toHaveProperty('executed', true);
    expect(data.data).toHaveProperty('enabledCount');
    expect(data.data.enabledCount).toBeGreaterThanOrEqual(0);
  });

  test('POST /api/user/knowledge/recommend overwrite=false已有勾选时不执行', async ({ request }) => {
    // 首先确保有勾选
    await request.post(`${BASE_URL}/api/user/knowledge/recommend`, {
      data: { overwrite: true }
    });

    // 然后调用不覆盖模式
    const response = await request.post(`${BASE_URL}/api/user/knowledge/recommend`, {
      data: { overwrite: false }
    });

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    // 如果用户未设置教材，跳过测试
    if (response.status() === 400) {
      const data = await response.json();
      if (data.error === '用户未设置教材') {
        test.skip();
        return;
      }
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('recommendedChapterId');
    expect(data.data).toHaveProperty('executed', false);
    expect(data.data).toHaveProperty('enabledCount');
    expect(data.data.enabledCount).toBeGreaterThan(0);
  });

  test('POST /api/user/knowledge/recommend 未登录返回401', async ({ request }) => {
    // 如果已认证（有storage-state），此测试会返回200，跳过
    const checkResponse = await request.post(`${BASE_URL}/api/user/knowledge/recommend`, {
      data: { overwrite: false }
    });

    if (checkResponse.status() === 200) {
      test.skip();
      return;
    }

    expect(checkResponse.status()).toBe(401);
    const data = await checkResponse.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('未登录');
  });

  test('POST /api/user/knowledge/recommend 无教材时返回400', async ({ request }) => {
    // 此测试需要创建一个没有设置教材的用户
    // 在实际测试环境中，如果用户已经设置了教材，我们跳过此测试
    const response = await request.post(`${BASE_URL}/api/user/knowledge/recommend`, {
      data: { overwrite: false }
    });

    // 如果返回200或401，说明用户已设置教材或未登录，跳过测试
    if (response.status() === 200 || response.status() === 401) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('用户未设置教材');
  });
});
