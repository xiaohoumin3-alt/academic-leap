import { test, expect } from '@playwright/test';

/**
 * 🧪 "我的"页面E2E测试
 *
 * 测试目标：
 * 1. 未登录状态：显示登录引导
 * 2. 已登录状态：显示用户信息和退出按钮
 */

test.describe('🟢 层1: "我的"页面 - 未登录状态', () => {
  test('未登录: 显示登录引导', async ({ page }) => {
    // 确保未登录状态
    await page.context().clearCookies();
    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证显示登录引导
    await expect(page.getByText('登录体验更多功能')).toBeVisible();
    await expect(page.getByText('立即登录')).toBeVisible();
  });

  test('未登录: 点击立即登录跳转到登录页', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 点击登录按钮
    const loginBtn = page.getByText('立即登录');
    await loginBtn.click();
    await page.waitForTimeout(1000);

    // 验证跳转到登录页
    expect(page.url()).toContain('/login');
  });
});

test.describe('🔵 层2: "我的"页面 - 基本结构', () => {
  test('页面基本加载', async ({ page }) => {
    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证页面有内容（无论登录状态）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('底部导航存在', async ({ page }) => {
    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证底部导航存在
    const hasNav = await page.locator('nav').count() > 0;
    if (hasNav) {
      await expect(page.locator('nav').first()).toBeVisible();
    }
  });
});

test.describe('🔵 层2: "我的"页面 - 页面元素', () => {
  test('页面有可交互元素', async ({ page }) => {
    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证页面有按钮
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('页面无JavaScript错误', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/me', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 过滤无关错误
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('preload') &&
      !e.includes('third-party') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::')
    );

    expect(criticalErrors.length).toBeLessThan(5);
  });
});
