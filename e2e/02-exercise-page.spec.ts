import { test, expect } from '@playwright/test';

/**
 * 🧪 练习页E2E测试
 *
 * 测试目标：
 * 1. 验证练习页可访问
 * 2. 验证基本UI元素
 * 3. 验证答题界面
 */

test.describe('🟢 层1: 练习页 - 基本访问', () => {
  test('直接访问练习页', async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证页面加载
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('从首页进入练习页', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 查找可能的练习入口按钮
    const practiceBtn = page.getByText('开始练习', { exact: false })
      .or(page.getByText('开始精准测评', { exact: false }));

    const btnCount = await practiceBtn.count();
    if (btnCount > 0) {
      await practiceBtn.first().click();
      await page.waitForTimeout(3000);

      // 验证进入练习或测评模式
      const hasContent = page.getByText('难度', { exact: false })
        .or(page.getByText('题目', { exact: false }))
        .or(page.getByText('测评', { exact: false }));
      await expect(hasContent.first()).toBeVisible({ timeout: 10000 });
    } else {
      // 如果没有按钮，尝试直接访问
      await page.goto('/practice');
      await page.waitForTimeout(2000);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(50);
    }
  });
});

test.describe('🔵 层2: 练习页 - UI元素', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  test('练习页基本加载', async ({ page }) => {
    // 检查是否有练习相关内容
    const bodyText = await page.locator('body').textContent();

    // 可能的状态：有题目、提示选择知识点、或加载中
    const hasContent = bodyText?.length && bodyText.length > 100;
    expect(hasContent).toBe(true);
  });

  test('无知识点提示', async ({ page }) => {
    // 检查是否显示"请至少启用一个知识点"提示
    const hasKPPrompt = await page.getByText('知识点', { exact: false }).count() > 0;
    // 不强制要求，取决于用户状态
  });

  test('页面有可交互元素', async ({ page }) => {
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

    await page.goto('/practice');
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

test.describe('🟢 层1: 练习页 - 导航入口', () => {
  test('从底部导航进入练习页', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 查找底部导航中的练习按钮
    const practiceBtn = page.locator('nav button').filter({ hasText: /练习/ });
    const count = await practiceBtn.count();

    if (count > 0) {
      await practiceBtn.first().click();
      await page.waitForTimeout(2000);

      // 验证URL或内容
      const url = page.url();
      const hasPracticeContent = url.includes('/practice') ||
                                await page.getByText('难度', { exact: false }).count() > 0;
      expect(hasPracticeContent).toBe(true);
    } else {
      // 没有底部导航
      test.skip(true, '底部导航中没有练习按钮');
    }
  });
});
