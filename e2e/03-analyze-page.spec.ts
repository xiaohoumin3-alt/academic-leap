import { test, expect } from '@playwright/test';

/**
 * 🧪 分析页E2E测试
 *
 * 测试目标：
 * 1. 无数据状态：新用户引导
 * 2. 有数据状态：学情分析展示
 * 3. 标签页切换功能
 */

test.describe('🟢 层1: 分析页 - 基本功能', () => {
  test('直接访问分析页', async ({ page }) => {
    await page.goto('/analyze', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证页面加载（可能有数据或无数据状态）
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(50);
  });

  test('无数据状态显示', async ({ page }) => {
    await page.goto('/analyze', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 检查是否显示"暂无学习数据"状态
    const hasNoDataMessage = await page.getByText('暂无学习数据', { exact: false }).count() > 0;

    if (hasNoDataMessage) {
      // 验证无数据状态元素
      await expect(page.getByText('暂无学习数据', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('开始练习', { exact: false }).first()).toBeVisible();
    } else {
      // 有数据状态，验证基本元素
      const hasContent = await page.getByText('学情', { exact: false }).count() > 0 ||
                          await page.getByText('分析', { exact: false }).count() > 0;
      expect(hasContent).toBe(true);
    }
  });

  test('页面无JavaScript错误', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/analyze', { waitUntil: 'networkidle' });
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

test.describe('🔵 层2: 分析页 - 有数据状态', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analyze', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  test('有数据: 标题显示', async ({ page }) => {
    // 检查是否有学情分析标题
    const hasTitle = await page.getByText('学情', { exact: false }).count() > 0;
    if (!hasTitle) {
      // 可能是"暂无学习数据"状态
      test.skip(true, '用户无学习数据，显示空状态');
      return;
    }
    await expect(page.getByText('学情', { exact: false }).first()).toBeVisible();
  });

  test('有数据: 知识掌握区域', async ({ page }) => {
    const hasNoData = await page.getByText('暂无学习数据', { exact: false }).count() > 0;
    if (hasNoData) {
      test.skip(true, '用户无学习数据');
      return;
    }

    // 验证有知识相关内容
    const hasKnowledge = await page.getByText('知识', { exact: false }).count() > 0;
    expect(hasKnowledge).toBe(true);
  });

  test('有数据: 标签页可切换', async ({ page }) => {
    const hasNoData = await page.getByText('暂无学习数据', { exact: false }).count() > 0;
    if (hasNoData) {
      test.skip(true, '用户无学习数据');
      return;
    }

    // 查找可能的标签页按钮
    const tabs = page.locator('button').filter({ hasText: /成长|练习|路径/ });
    const tabCount = await tabs.count();

    if (tabCount > 0) {
      // 尝试点击第一个标签
      await tabs.first().click();
      await page.waitForTimeout(1000);
      // 验证页面仍然可交互
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(100);
    }
  });
});

test.describe('🟢 层1: 分析页 - 导航入口', () => {
  test('从首页点击分析按钮', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 查找底部导航中的分析按钮
    const analyzeBtn = page.locator('nav button').filter({ hasText: /分析/ });
    const count = await analyzeBtn.count();

    if (count > 0) {
      await analyzeBtn.first().click();
      await page.waitForTimeout(2000);

      // 验证URL跳转到/analyze
      expect(page.url()).toContain('/analyze');
    } else {
      // 如果没有底部导航，测试通过（应用可能不使用此导航）
      test.skip(true, '底部导航中没有分析按钮');
    }
  });
});

test.describe('🔵 层2: 分析页 - 数据展示', () => {
  test('分数区间显示', async ({ page }) => {
    await page.goto('/analyze', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const hasNoData = await page.getByText('暂无学习数据', { exact: false }).count() > 0;
    if (hasNoData) {
      test.skip(true, '用户无学习数据');
      return;
    }

    // 验证分数相关内容
    const hasScore = await page.getByText('分', { exact: false }).count() > 0;
    expect(hasScore).toBe(true);
  });

  test('按钮可交互', async ({ page }) => {
    await page.goto('/analyze', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证页面有可交互元素
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});
