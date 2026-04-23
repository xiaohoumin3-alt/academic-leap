import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('后台管理系统', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/console/login`);
  });

  test('登录功能', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${BASE_URL}/console`);
    await expect(page.locator('text=内容引擎控制台')).toBeVisible();
  });

  test('登录失败 - 错误密码', async ({ page }) => {
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=登录失败')).toBeVisible();
  });

  test.describe('知识点管理', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/console`);
    });

    test('查看知识点列表', async ({ page }) => {
      await page.click('text=知识点管理');
      await expect(page.locator('text=共')).toBeVisible();
    });

    test('创建新知识点', async ({ page }) => {
      await page.click('text=知识点管理');
      await page.click('text=新建知识点');

      await page.fill('input[placeholder*="名称"]', '测试知识点');
      await page.selectOption('select', '初中');
      await page.click('button:has-text("保存")');

      await expect(page.locator('text=知识点已创建')).toBeVisible();
    });

    test('编辑知识点', async ({ page }) => {
      await page.click('text=知识点管理');

      const firstRow = page.locator('tbody tr').first();
      await firstRow.locator('button').first().click();

      await page.fill('input[placeholder*="名称"]', '更新的知识点');
      await page.click('button:has-text("保存")');

      await expect(page.locator('text=知识点已更新')).toBeVisible();
    });

    test('搜索知识点', async ({ page }) => {
      await page.click('text=知识点管理');
      await page.fill('input[placeholder*="搜索"]', '代数');
      await page.waitForTimeout(500);

      const rows = page.locator('tbody tr');
      await expect(rows.count()).resolves.toBeGreaterThan(0);
    });
  });

  test.describe('模板编辑器', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/console`);
    });

    test('查看模板列表', async ({ page }) => {
      await page.click('text=模板编辑器');
      await expect(page.locator('text=模板列表')).toBeVisible();
    });

    test('创建新模板', async ({ page }) => {
      await page.click('text=模板编辑器');
      await page.click('button:has-text("新建")');

      await page.fill('input[placeholder*="模板名称"]', '测试模板');
      await page.selectOption('select', 'calculation');
      await page.click('button:has-text("保存模板")');

      await expect(page.locator('text=模板已保存')).toBeVisible();
    });

    test('预览模板生成题目', async ({ page }) => {
      await page.click('text=模板编辑器');
      await page.click('button:has-text("新建")');

      await page.fill('input[placeholder*="模板名称"]', '预览测试');
      await page.selectOption('select', 'calculation');
      await page.click('button:has-text("生成题目")');

      await page.waitForTimeout(3000);
      await expect(page.locator('text=题目生成成功')).toBeVisible();
    });
  });

  test.describe('难度校准', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/console`);
    });

    test('查看难度矩阵', async ({ page }) => {
      await page.click('text=难度校准');
      await expect(page.locator('text=难度校准矩阵')).toBeVisible();
      await expect(page.locator('text=Target: 60-80%')).toBeVisible();
    });

    test('AI调参建议', async ({ page }) => {
      await page.click('text=难度校准');
      await page.click('button:has-text("AI 调参建议")');

      await expect(page.locator('text=AI 正在分析数据')).toBeVisible();
    });

    test('异常检测', async ({ page }) => {
      await page.click('text=难度校准');
      await expect(page.locator('text=异常检测')).toBeVisible();
    });
  });

  test.describe('质量分析', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/console`);
    });

    test('运行全部检测', async ({ page }) => {
      await page.click('text=质量分析');
      await page.click('button:has-text("运行全部检测")');

      await expect(page.locator('text=检测中')).toBeVisible();
      await page.waitForTimeout(3000);
      await expect(page.locator('text=检测统计')).toBeVisible();
    });
  });

  test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(`${BASE_URL}/console`);
    });

    test('查看Dashboard', async ({ page }) => {
      await page.click('text=Dashboard');
      await expect(page.locator('text=知识点总数')).toBeVisible();
      await expect(page.locator('text=题库模板')).toBeVisible();
      await expect(page.locator('text=难度级别')).toBeVisible();
      await expect(page.locator('text=权重总和')).toBeVisible();
    });
  });

  test.describe('权限控制', () => {
    test('viewer角色不能编辑', async ({ page }) => {
      // 登录viewer账户（需要先创建）
      await page.goto(`${BASE_URL}/console/login`);
      await page.fill('input[type="email"]', 'viewer@example.com');
      await page.fill('input[type="password"]', 'viewer123');
      await page.click('button[type="submit"]');

      await page.waitForURL(`${BASE_URL}/console`);

      // viewer不应该看到"新建知识点"按钮
      await page.click('text=知识点管理');
      await expect(page.locator('button:has-text("新建知识点")')).toHaveCount(0);
    });
  });
});
