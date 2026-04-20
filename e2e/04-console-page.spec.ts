import { test, expect } from '@playwright/test';

/**
 * 🧪 后台管理功能测试
 *
 * 测试目标：
 * 1. 验证内容生产系统
 * 2. 验证控制系统
 * 3. 验证监控系统
 */

/**
 * 辅助函数：导航到控制台页面
 */
async function navigateToConsole(page: any) {
  await page.goto('/console');
  // 等待页面加载 - 使用更宽松的条件
  await page.waitForLoadState('domcontentloaded');
  // 等待至少一个关键元素可见
  await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
}

/**
 * 辅助函数：点击指定的Tab
 */
async function clickTab(page: any, tabText: string) {
  // 使用 role 和 name 组合定位器，更精确
  const tab = page.getByRole('button', { name: tabText, exact: false });
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.first().click();
    await page.waitForTimeout(500);
  }
}

test.describe('🔧 后台管理: 入口与导航', () => {
  test('后台入口: 直接访问', async ({ page }) => {
    await navigateToConsole(page);
    // 验证页面已加载
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('后台: 页面基本元素', async ({ page }) => {
    await navigateToConsole(page);
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

/**
 * CASE 1: 知识点创建
 */
test.describe('🔧 CASE 1: 知识点管理', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConsole(page);
    await clickTab(page, '知识点管理');
  });

  test('CASE 1: 页面加载', async ({ page }) => {
    // 验证表格存在
    const table = page.locator('table');
    const hasTable = await table.count() > 0;
    expect(hasTable).toBe(true);
  });

  test('CASE 1: 知识点内容', async ({ page }) => {
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

/**
 * CASE 2: 模板创建与编辑
 */
test.describe('🔧 CASE 2: 模板编辑器', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConsole(page);
    await clickTab(page, '模板编辑器');
  });

  test('CASE 2: 页面加载', async ({ page }) => {
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('CASE 2: 模板列表区域', async ({ page }) => {
    // 验证模板相关内容存在
    const hasTemplateText = await page.getByText('模板', { exact: false }).count() > 0;
    expect(hasTemplateText).toBe(true);
  });

  test('CASE 2: Level按钮', async ({ page }) => {
    // 验证Level按钮存在
    const levelButtons = page.locator('button').filter({ hasText: /^L[0-4]$/ });
    const count = await levelButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('CASE 2: 编辑区域', async ({ page }) => {
    // 验证编辑区域存在
    const bodyText = await page.locator('body').textContent();
    // 检查是否有编辑相关的内容
    const hasEditContent = bodyText?.includes('JSON') || bodyText?.includes('结构') || bodyText?.includes('定义');
    expect(hasEditContent).toBe(true);
  });
});

/**
 * CASE 3: 难度校准系统
 */
test.describe('🔧 CASE 3: 难度校准', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConsole(page);
    await clickTab(page, '难度校准');
  });

  test('CASE 3: 页面加载', async ({ page }) => {
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('CASE 3: 难度级别显示', async ({ page }) => {
    // 验证有难度级别相关内容
    const hasLevelContent = await page.getByText('L0', { exact: false }).count() > 0;
    expect(hasLevelContent).toBe(true);
  });

  test('CASE 3: 系统状态', async ({ page }) => {
    // 验证有系统相关内容
    const bodyText = await page.locator('body').textContent();
    const hasSystemContent = bodyText?.includes('系统') || bodyText?.includes('活力') || bodyText?.includes('健康');
    expect(hasSystemContent).toBe(true);
  });
});

/**
 * CASE 4: 分数映射系统
 */
test.describe('🔧 CASE 4: 分数地图', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConsole(page);
    await clickTab(page, '分数地图');
  });

  test('CASE 4: 页面加载', async ({ page }) => {
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('CASE 4: 分数相关内容', async ({ page }) => {
    // 验证有分数相关内容
    const bodyText = await page.locator('body').textContent();
    const hasScoreContent = bodyText?.includes('分') || bodyText?.includes('权重') || bodyText?.includes('平衡');
    expect(hasScoreContent).toBe(true);
  });
});

/**
 * CASE 5: 质量分析
 */
test.describe('🔧 CASE 5: 质量分析', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToConsole(page);
    await clickTab(page, '质量分析');
  });

  test('CASE 5: 页面加载', async ({ page }) => {
    // 验证页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('CASE 5: 质量检测内容', async ({ page }) => {
    // 验证有质量相关内容
    const bodyText = await page.locator('body').textContent();
    const hasQualityContent = bodyText?.includes('检测') || bodyText?.includes('诊断') || bodyText?.includes('分析');
    expect(hasQualityContent).toBe(true);
  });
});

/**
 * 全局操作测试
 */
test.describe('🔧 后台全局操作', () => {
  test('页面基本可用性', async ({ page }) => {
    await navigateToConsole(page);
    // 验证页面可交互
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

/**
 * CASE 7: 内容闭环测试
 */
test.describe('🔧 CASE 7: 内容闭环', () => {
  test('后台-前台连通性', async ({ page }) => {
    // 1. 进入后台
    await navigateToConsole(page);

    // 2. 返回前台
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 3. 验证前台页面有内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});
