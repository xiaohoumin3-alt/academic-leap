/**
 * Phase 6: E2E测试 - 复测评场景2触发
 *
 * 测试滑动窗口检测和复测评触发流程
 */

import { test, expect } from './fixtures';

test.describe('复测评场景2 - 练习达成触发', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('练习20题达到90%正确率应触发复测评提示', async ({ page }) => {
    // 进入练习页面
    await page.click('[data-testid="nav-practice"]');
    await page.waitForURL('/practice');

    // 模拟连续练习20题，正确18题（90%）
    for (let i = 0; i < 20; i++) {
      await page.waitForSelector('[data-testid="question-container"]');

      // 前18题答对，后2题答错
      const isCorrect = i < 18;
      const answer = isCorrect ? 'correct' : 'wrong';
      await page.fill(`input[name="answer"]`, answer);
      await page.click('button[type="submit"]');

      // 等待下一题或反馈
      await page.waitForTimeout(500);
    }

    // 验证显示复测评提示
    await expect(page.locator('[data-testid="reassessment-prompt"]')).toBeVisible();
    await expect(page.locator('text=练习达成')).toBeVisible();
  });

  test('未达到90%正确率不应触发复测评', async ({ page }) => {
    await page.click('[data-testid="nav-practice"]');
    await page.waitForURL('/practice');

    // 练习20题，正确15题（75%）
    for (let i = 0; i < 20; i++) {
      await page.waitForSelector('[data-testid="question-container"]');
      const isCorrect = i < 15;
      await page.fill(`input[name="answer"]`, isCorrect ? 'correct' : 'wrong');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // 不应显示复测评提示
    await expect(page.locator('[data-testid="reassessment-prompt"]')).not.toBeVisible();
  });

  test('手动复测评入口应可用', async ({ page }) => {
    await page.click('[data-testid="nav-me"]');
    await page.waitForURL('/me');

    // 检查手动复测评按钮
    await expect(page.locator('[data-testid="manual-reassessment"]')).toBeVisible();

    // 点击手动复测评
    await page.click('[data-testid="manual-reassessment"]');
    await page.waitForURL('/assessment');
  });
});
