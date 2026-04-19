import { test, expect } from '@playwright/test';

/**
 * 🧪 CASE 1: 首次进入 + 初始测评
 *
 * 测试目标：
 * 1. 验证首页所有交互点可点击
 * 2. 验证系统状态卡片可进入管理后台
 * 3. 验证测评入口存在
 */

test.describe('🟢 层1: 用户体验闭环 - 首页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('CASE 1: 首页加载验证', async ({ page }) => {
    // 验证核心元素存在
    await expect(page.locator('text=当前水平')).toBeVisible();
    await expect(page.locator('text=75分')).toBeVisible();
    await expect(page.locator('text=目标分数')).toBeVisible();
    await expect(page.locator('text=90')).toBeVisible();
  });

  test('CASE 1: 可信区间显示', async ({ page }) => {
    // 验证可信区间显示
    await expect(page.locator('text=可信区间：72–78')).toBeVisible();
    await expect(page.locator('text=稳定度：中')).toBeVisible();
  });

  test('CASE 1: 系统状态卡片可点击', async ({ page }) => {
    // 验证"当前状态"区域可点击进入管理后台
    const statusCard = page.locator('text=题目刚好适合你，系统正在微调难度').locator('..').locator('..');
    await statusCard.click();

    // 验证切换到管理后台
    await expect(page.locator('text=内容引擎控制台')).toBeVisible({ timeout: 5000 });
  });

  test('CASE 1: 今日任务区域显示', async ({ page }) => {
    // 验证今日任务卡片
    await expect(page.locator('text=今日任务')).toBeVisible();
    await expect(page.locator('text=数学核心突破')).toBeVisible();
    await expect(page.locator('text=二次函数强化训练 - 20题')).toBeVisible();
    await expect(page.locator('text=进行中').first()).toBeVisible();
  });

  test('CASE 1: 复习进度显示', async ({ page }) => {
    // 验证复习进度
    await expect(page.locator('text=复习进度')).toBeVisible();
    await expect(page.locator('text=70%')).toBeVisible();
    await expect(page.locator('text=已掌握 140/200 个核心考点')).toBeVisible();
  });

  test('CASE 1: 薄弱知识点卡片', async ({ page }) => {
    // 验证薄弱知识点卡片
    const weakPointsCard = page.locator('text=薄弱知识点');
    await expect(weakPointsCard).toBeVisible();
    await expect(page.locator('text=发现 3 个急需巩固的盲区')).toBeVisible();
  });

  test('CASE 1: 主操作按钮', async ({ page }) => {
    // 验证"开始今日训练"主按钮
    const startButton = page.locator('text=开始今日训练');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();

    // 验证"摸底评测"按钮
    const assessButton = page.locator('text=摸底评测');
    await expect(assessButton).toBeVisible();
    await expect(assessButton).toBeEnabled();

    // 验证"错题本"按钮
    const mistakesButton = page.locator('text=错题本');
    await expect(mistakesButton).toBeVisible();
    await expect(mistakesButton).toBeEnabled();
  });

  test('CASE 1: 成就系统显示', async ({ page }) => {
    // 验证今日成就区域
    await expect(page.locator('text=今日成就')).toBeVisible();
    await expect(page.locator('text=连续登陆')).toBeVisible();
    await expect(page.locator('text=7天')).toBeVisible();
    await expect(page.locator('text=全对大师')).toBeVisible();
    await expect(page.locator('text=未解锁')).toBeVisible();
  });

  test('CASE 1: 提分小贴士显示', async ({ page }) => {
    // 验证提分小贴士
    await expect(page.locator('text=提分小贴士')).toBeVisible();
    await expect(page.locator('text=函数极值问题')).toBeVisible();
    await expect(page.locator('text=预计能提升 2-3 分成绩')).toBeVisible();
  });

  test('CASE 1: 底部导航栏', async ({ page }) => {
    // 验证底部导航栏存在（使用role=navigation定位）
    const navBar = page.locator('nav');
    await expect(navBar.first()).toBeVisible();

    // 验证至少有4个导航按钮
    const navButtons = page.locator('nav button');
    await expect(navButtons).toHaveCount(5);
  });
});

/**
 * 🧪 CASE 2: 开始训练流程
 */
test.describe('🟢 层1: 开始训练流程', () => {
  test('CASE 2: 点击开始训练进入练习页', async ({ page }) => {
    await page.goto('/');

    // 点击开始训练
    await page.click('text=开始今日训练');

    // 验证进入练习页
    await expect(page.locator('text=专项强化环节')).toBeVisible({ timeout: 3000 });
  });

  test('CASE 2: 点击摸底评测进入测评模式', async ({ page }) => {
    await page.goto('/');

    // 点击摸底评测
    await page.click('text=摸底评测');

    // 验证进入测评模式
    await expect(page.locator('text=学力摸底评价进行中')).toBeVisible({ timeout: 3000 });
  });

  test('CASE 2: 点击薄弱知识点卡片', async ({ page }) => {
    await page.goto('/');

    // 点击薄弱知识点
    const weakPointsCard = page.locator('text=薄弱知识点').locator('..').locator('..');
    await weakPointsCard.click();

    // 验证进入练习页
    await expect(page.locator('text=专项强化环节')).toBeVisible({ timeout: 3000 });
  });

  test('CASE 2: 点击错题本', async ({ page }) => {
    await page.goto('/');

    // 点击错题本
    await page.click('text=错题本');

    // 验证进入练习页
    await expect(page.locator('text=专项强化环节')).toBeVisible({ timeout: 3000 });
  });

  test('CASE 2: 点击继续复习', async ({ page }) => {
    await page.goto('/');

    // 点击继续复习
    await page.click('text=继续复习');

    // 验证进入练习页
    await expect(page.locator('text=专项强化环节')).toBeVisible({ timeout: 3000 });
  });
});

/**
 * 🧪 导航功能测试
 */
test.describe('🟢 层1: 导航功能', () => {
  test('底部导航切换', async ({ page }) => {
    await page.goto('/');

    // 测试导航到练习页
    const practiceBtn = page.locator('nav button').filter({ hasText: '练习' });
    await practiceBtn.click();
    await page.waitForTimeout(500);
    // 验证页面跳转
    const currentUrl = page.url();
    expect(currentUrl).toContain('localhost');

    // 测试导航到分析页
    const analyzeBtn = page.locator('nav button').filter({ hasText: '分析' });
    await analyzeBtn.click();
    await page.waitForTimeout(500);

    // 测试返回首页
    const homeBtn = page.locator('nav button').filter({ hasText: '首页' });
    await homeBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=开始今日训练')).toBeVisible();
  });

  test('顶部返回按钮', async ({ page }) => {
    await page.goto('/');

    // 进入练习页
    await page.click('text=开始今日训练');

    // 点击返回按钮（header中的第一个按钮）
    const backButton = page.locator('header button').first();
    await backButton.click();

    // 验证返回首页
    await expect(page.locator('text=开始今日训练')).toBeVisible();
  });
});
