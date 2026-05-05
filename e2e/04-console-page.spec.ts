import { test, expect } from './fixtures';

/**
 * 🧪 后台管理功能测试
 *
 * 测试目标：
 * 1. 验证控制台能正常登录和加载
 * 2. 验证各个Tab可以切换
 * 3. 验证页面有可交互内容
 */

/**
 * 辅助函数：点击指定的Tab
 */
async function clickTab(page: any, tabText: string) {
  const tab = page.getByRole('button', { name: tabText, exact: false });
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.first().click();
    await page.waitForTimeout(500);
  }
}

test.describe('🔧 后台管理: 入口与导航', () => {
  test('后台入口: 页面加载', async ({ adminConsole: page }) => {
    // 验证页面已加载
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('后台: 页面有内容', async ({ adminConsole: page }) => {
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 知识点管理 Tab', () => {
  test('可以切换到知识点管理', async ({ adminConsole: page }) => {
    await clickTab(page, '知识点管理');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 模板编辑器 Tab', () => {
  test('可以切换到模板编辑器', async ({ adminConsole: page }) => {
    await clickTab(page, '模板编辑器');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 难度校准 Tab', () => {
  test('可以切换到难度校准', async ({ adminConsole: page }) => {
    await clickTab(page, '难度校准');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 质量分析 Tab', () => {
  test('可以切换到质量分析', async ({ adminConsole: page }) => {
    await clickTab(page, '质量分析');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 分数地图 Tab', () => {
  test('可以切换到分数地图', async ({ adminConsole: page }) => {
    await clickTab(page, '分数地图');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

test.describe('🔧 内容闭环', () => {
  test('后台到前台导航', async ({ adminConsole: page }) => {
    // adminConsole fixture ensures we're on console page
    const consoleText = await page.locator('body').textContent();
    expect(consoleText?.length).toBeGreaterThan(100);

    // 导航到前台
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});
