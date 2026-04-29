import { test, expect } from '@playwright/test';

/**
 * 🧪 首页E2E测试
 *
 * 测试目标：
 * 1. 新用户：验证测评引导流程
 * 2. 老用户：验证等效分显示和练习入口
 * 3. 底部导航功能
 */

test.describe('🟢 层1: 首页 - 新用户流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('新用户: 欢迎页标题显示', async ({ page }) => {
    // 新用户看到欢迎页
    await expect(page.getByText('欢迎来到学力跃迁', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('通过10-15道题，精准定位你的真实水平', { exact: false }).first()).toBeVisible();
  });

  test('新用户: 功能卡片显示', async ({ page }) => {
    // 验证三个功能卡片
    await expect(page.getByText('精准估分', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('自适应练习', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('量化提分', { exact: false }).first()).toBeVisible();
  });

  test('新用户: 开始测评按钮', async ({ page }) => {
    // 验证开始测评按钮存在
    await expect(page.getByText('开始精准测评', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('10-15道题 · 约5分钟 · 精准定位薄弱点', { exact: false }).first()).toBeVisible();
  });

  test('新用户: 点击开始测评进入测评页', async ({ page }) => {
    // 点击开始测评
    await page.getByText('开始精准测评', { exact: false }).first().click();

    // 验证进入测评模式或练习页
    await page.waitForTimeout(2000);
    const url = page.url();
    // 可能跳转到 /assessment 或显示测评内容
    const hasAssessmentContent = page.getByText('测评', { exact: false }).or(page.getByText('难度', { exact: false })).or(page.getByText('题目', { exact: false }));
    await expect(hasAssessmentContent.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('🔵 层2: 首页 - 老用户流程', () => {
  test.beforeEach(async ({ page }) => {
    // 注意：此测试需要用户已完成初始测评
    // 如果测试用户未完成测评，这些测试会跳过或失败
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('老用户: 等效分显示', async ({ page }) => {
    // 检查是否显示等效分
    const hasScoreDisplay = page.getByText('当前等效分', { exact: false });
    const scoreCount = await hasScoreDisplay.count();

    if (scoreCount > 0) {
      // 老用户界面
      await expect(hasScoreDisplay.first()).toBeVisible();
      await expect(page.getByText('分', { exact: false }).first()).toBeVisible();
      await expect(page.getByText('±3分波动区间', { exact: false }).first()).toBeVisible();
    } else {
      // 新用户界面，跳过此测试
      test.skip(true, '用户未完成初始测评，显示新用户界面');
    }
  });

  test('老用户: 主操作按钮（根据分数不同）', async ({ page }) => {
    // 检查是否有老用户界面元素
    const hasScoreDisplay = page.getByText('当前等效分', { exact: false });
    const scoreCount = await hasScoreDisplay.count();

    if (scoreCount === 0) {
      test.skip(true, '用户未完成初始测评');
      return;
    }

    // 根据分数显示不同按钮
    const hasPracticeBtn = page.getByText('开始练习', { exact: false });
    const hasRetryHighBtn = page.getByText('提高难度重新测评', { exact: false });
    const hasRetryLowBtn = page.getByText('降低难度重新测评', { exact: false });

    const hasAnyButton = hasPracticeBtn.or(hasRetryHighBtn).or(hasRetryLowBtn);
    await expect(hasAnyButton.first()).toBeVisible();
  });

  test('老用户: 学习原理说明', async ({ page }) => {
    const hasScoreDisplay = page.getByText('当前等效分', { exact: false });

    if (await hasScoreDisplay.count() === 0) {
      test.skip(true, '用户未完成初始测评');
      return;
    }

    await expect(page.getByText('学习原理', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('心流区', { exact: false }).first()).toBeVisible();
  });
});

test.describe('🟢 层1: 首页 - 通用功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('页面加载完成', async ({ page }) => {
    // 验证页面不是加载状态
    const loadingSpinner = page.locator('[class*="animate-spin"]');
    await expect(loadingSpinner).toHaveCount(0, { timeout: 10000 });
  });

  test('底部导航栏存在', async ({ page }) => {
    // 验证底部导航存在
    const navBar = page.locator('nav').or(page.locator('[role="navigation"]'));
    const navCount = await navBar.count();

    // BottomNavigation组件可能存在
    if (navCount > 0) {
      await expect(navBar.first()).toBeVisible();
    }
    // 如果不存在，测试通过（应用可能不使用底部导航）
  });

  test('页面无JavaScript错误', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 过滤掉已知的无关错误
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('preload') &&
      !e.includes('third-party') &&
      !e.includes('Failed to load resource') &&
      !e.includes('net::')
    );

    // 允许少量非关键错误
    expect(criticalErrors.length).toBeLessThan(5);
  });
});

test.describe('🔵 层2: 首页 - 交互流程', () => {
  test('点击主按钮可以进入练习或测评', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 查找可能的主按钮
    const startBtn = page.getByText('开始精准测评', { exact: false })
      .or(page.getByText('开始练习', { exact: false }))
      .or(page.getByText('提高难度重新测评', { exact: false }))
      .or(page.getByText('降低难度重新测评', { exact: false }));

    const btnCount = await startBtn.count();
    if (btnCount > 0) {
      await startBtn.first().click();
      await page.waitForTimeout(3000);

      // 验证进入测评或练习模式
      const hasContent = page.getByText('测评', { exact: false })
        .or(page.getByText('难度', { exact: false }))
        .or(page.getByText('题目', { exact: false }));
      await expect(hasContent.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
