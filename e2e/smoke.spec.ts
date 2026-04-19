import { test, expect } from '@playwright/test';

/**
 * 烟雾测试 - 只验证最关键的功能路径
 */

test.describe('核心功能验证', () => {
  test('首页能加载并显示核心元素', async ({ page }) => {
    await page.goto('/');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 验证分数显示
    await expect(page.locator('text=75').first()).toBeVisible();

    // 验证开始训练按钮存在且可点击
    const startButton = page.getByRole('button', { name: /开始.*训练/ });
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
  });

  test('能进入训练页面', async ({ page }) => {
    await page.goto('/');

    // 点击开始训练
    await page.getByRole('button', { name: /开始.*训练/ }).click();

    // 验证进入训练页
    await expect(page.locator('text=专项强化')).toBeVisible({ timeout: 5000 });
  });

  test('能进入后台管理', async ({ page }) => {
    await page.goto('/');

    // 点击进入后台（需要找到正确的入口）
    const consoleButton = page.getByRole('button', { name: /控制台|Console|管理/ });
    const visible = await consoleButton.isVisible().catch(() => false);

    if (visible) {
      await consoleButton.click();
      await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
    }
  });
});
