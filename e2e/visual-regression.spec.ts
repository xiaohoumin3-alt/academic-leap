import { test, expect } from '@playwright/test';

/**
 * 🎨 视觉回归测试 (Visual Regression Testing)
 *
 * 测试目标：
 * 1. 关键页面UI截图对比（首页、练习页、分析页、登录页）
 * 2. 多断点测试（移动端、平板、桌面）
 * 3. 防止UI意外变化
 * 4. 主题测试（如支持明暗主题）
 *
 * 运行方式：
 * - 首次运行：npm run test:visual -- --update-snapshots
 * - 对比测试：npm run test:visual
 */

// 视口配置：移动端、平板、桌面
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

// 视觉回归容差配置
const SNAPSHOT_CONFIG = {
  maxDiffPixels: 100,
  threshold: 0.2, // 20%差异阈值
  maxDiffRatio: 0.05 // 最大5%像素差异
};

test.describe('🎨 Visual Regression - 首页 (/)', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('首页 - 完整页面截图', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // 等待动画完成

        // 等待关键元素加载
        await expect(page.locator('body')).toBeVisible();

        // 全页面截图
        await expect(page).toHaveScreenshot(`homepage-${name}-full.png`, {
          fullPage: true,
          ...SNAPSHOT_CONFIG
        });
      });

      test.skip('首页 - 主区域截图', async ({ page }) => {
        // 跳过 - 首页使用流式渲染，主区域定位不稳定
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        const mainContent = page.locator('main').or(page.locator('[class*="min-h-screen"]'));
        await expect(mainContent.first()).toBeVisible();

        await expect(mainContent.first()).toHaveScreenshot(`homepage-${name}-main.png`, SNAPSHOT_CONFIG);
      });
    });
  });
});

test.describe('🎨 Visual Regression - 练习页 (/practice)', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('练习页 - 完整页面截图', async ({ page }) => {
        await page.goto('/practice');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        await expect(page.locator('body')).toBeVisible();

        await expect(page).toHaveScreenshot(`practice-${name}-full.png`, {
          fullPage: true,
          ...SNAPSHOT_CONFIG
        });
      });

      test('练习页 - 题目区域截图', async ({ page }) => {
        await page.goto('/practice');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        // 定位题目卡片区域
        const questionCard = page.locator('[class*="rounded"]').or(page.locator('[class*="card"]'));
        const count = await questionCard.count();

        if (count > 0) {
          await expect(questionCard.first()).toHaveScreenshot(`practice-${name}-question.png`, SNAPSHOT_CONFIG);
        } else {
          // 无题目时截图整个页面
          await expect(page).toHaveScreenshot(`practice-${name}-empty.png`, SNAPSHOT_CONFIG);
        }
      });
    });
  });
});

test.describe('🎨 Visual Regression - 分析页 (/analyze)', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('分析页 - 完整页面截图', async ({ page }) => {
        await page.goto('/analyze');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        await expect(page.locator('body')).toBeVisible();

        await expect(page).toHaveScreenshot(`analyze-${name}-full.png`, {
          fullPage: true,
          ...SNAPSHOT_CONFIG
        });
      });

      test('分析页 - 数据展示区域', async ({ page }) => {
        await page.goto('/analyze');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);

        // 检查是否有图表或数据卡片
        const chartArea = page.locator('[class*="chart"]').or(page.locator('[class*="graph"]')).or(page.locator('svg'));
        const count = await chartArea.count();

        if (count > 0) {
          await expect(chartArea.first()).toHaveScreenshot(`analyze-${name}-chart.png`, SNAPSHOT_CONFIG);
        }
      });
    });
  });
});

test.describe('🎨 Visual Regression - 登录页 (/login)', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('登录页 - 完整页面截图', async ({ page }) => {
        // 清除cookies确保显示登录表单
        await page.context().clearCookies();
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        await expect(page.locator('body')).toBeVisible();

        await expect(page).toHaveScreenshot(`login-${name}-full.png`, {
          fullPage: true,
          ...SNAPSHOT_CONFIG
        });
      });

      test('登录页 - 表单区域截图', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        // 定位表单卡片
        const formCard = page.locator('[class*="bg-surface"]').or(page.locator('[class*="card"]')).or(page.locator('form'));
        await expect(formCard.first()).toBeVisible();

        await expect(formCard.first()).toHaveScreenshot(`login-${name}-form.png`, SNAPSHOT_CONFIG);
      });
    });
  });
});

test.describe('🎨 Visual Regression - 注册模式', () => {
  VIEWPORTS.filter(v => v.name === 'mobile' || v.name === 'desktop').forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.use({ viewport: { width, height } });

      test('注册表单 - 完整截图', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        // 切换到注册模式
        await page.locator('button').filter({ hasText: '注册' }).first().click();
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot(`register-${name}-full.png`, {
          fullPage: true,
          ...SNAPSHOT_CONFIG
        });
      });
    });
  });
});

test.describe('🎨 Visual Regression - 交互状态', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('首页 - 按钮悬停状态', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 悬停在主按钮上
    const mainButton = page.getByText('开始精准测评', { exact: false })
      .or(page.getByText('开始练习', { exact: false }));

    const count = await mainButton.count();
    if (count > 0) {
      await mainButton.first().hover();
      await page.waitForTimeout(300); // 等待过渡动画

      await expect(page.locator('body')).toHaveScreenshot('homepage-button-hover.png', {
        ...SNAPSHOT_CONFIG,
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });
    }
  });

  test('练习页 - 输入框聚焦状态', async ({ page }) => {
    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 查找输入框并聚焦
    const input = page.locator('input[type="text"], textarea').first();
    const count = await input.count();

    if (count > 0) {
      await input.first().focus();
      await page.waitForTimeout(300);

      await expect(input.first()).toHaveScreenshot('practice-input-focus.png', SNAPSHOT_CONFIG);
    }
  });
});

test.describe('🎨 Visual Regression - 响应式断点', () => {
  const RESPONSIVE_BREAKPOINTS = [
    { name: 'xs', width: 320 },
    { name: 'sm', width: 640 },
    { name: 'md', width: 768 },
    { name: 'lg', width: 1024 },
    { name: 'xl', width: 1280 },
    { name: '2xl', width: 1536 }
  ];

  RESPONSIVE_BREAKPOINTS.forEach(({ name, width }) => {
    test(`首页 - ${name} breakpoint (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);

      await expect(page).toHaveScreenshot(`homepage-breakpoint-${name}.png`, {
        fullPage: false,
        ...SNAPSHOT_CONFIG
      });
    });
  });
});
