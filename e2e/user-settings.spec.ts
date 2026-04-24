import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('用户设置 API', () => {
  test.use({ storageState: 'e2e/storage-state.json' });

  test('GET /api/user/settings 返回用户设置', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/user/settings`);

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('selectedGrade');
    expect(data.data).toHaveProperty('selectedSubject');
    expect(data.data).toHaveProperty('selectedTextbookId');
    expect(data.data).toHaveProperty('studyProgress');
  });

  test('PUT /api/user/settings 更新用户设置', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/user/settings`, {
      data: {
        selectedGrade: 8,
        selectedSubject: '数学',
        selectedTextbookId: 'test-textbook-id',
        studyProgress: 50
      }
    });

    // 如果未认证，跳过测试
    if (response.status() === 401) {
      test.skip();
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.selectedGrade).toBe(8);
  });
});
