import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ============================================================
// HELPERS
// ============================================================

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/console/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/console`, { timeout: 20000 });
  await page.waitForSelector('aside', { state: 'visible', timeout: 10000 });
}

async function clickSubtab(page: Page, label: string) {
  await page.locator('.space-y-6 button').filter({ hasText: label }).first().click();
}

async function clickSidebarNav(page: Page, label: string) {
  const btn = page.locator(`aside button:has-text("${label}")`);
  await expect(btn).toBeVisible({ timeout: 10000 });
  await btn.click();
}

async function openCreateModal(page: Page, modalTitle: string) {
  const createBtn = page.getByRole('button').filter({ hasText: /^新建/ }).filter({ hasText: new RegExp(modalTitle) }).first();
  await createBtn.click();
  await expect(page.locator(`h4:has-text("新建${modalTitle}")`)).toBeVisible({ timeout: 5000 });
}

// API helper using browser's fetch (so cookies are included)
async function apiCall(page: Page, method: string, path: string, body?: Record<string, unknown>) {
  return page.evaluate(async ({ base, m, p, b }) => {
    const opts: RequestInit = {
      method: m,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (b) opts.body = JSON.stringify(b);
    const res = await fetch(`${base}${p}`, opts);
    const json = await res.json();
    return { status: res.status, data: json };
  }, { base: BASE_URL, m: method, p: path, b: body });
}

// ============================================================
// TESTS
// ============================================================

test.describe('知识树过滤系统 - 教材/章节/知识点管理', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await clickSidebarNav(page, '知识点管理');
    await expect(page.locator('h3:has-text("教材库")')).toBeVisible({ timeout: 10000 });
  });

  // ============================================================
  // SECTION 1: SUB-TAB NAVIGATION
  // ============================================================

  test('1.1 - 默认显示教材库内容', async ({ page }) => {
    await expect(page.locator('h3:has-text("教材库")')).toBeVisible();
  });

  test('1.2 - 章节管理子标签在选中教材前被禁用', async ({ page }) => {
    const btn = page.locator('.space-y-6 button').filter({ hasText: '章节管理' }).first();
    await expect(btn).toBeDisabled();
  });

  test('1.3 - 知识点管理子标签在选中章节前被禁用', async ({ page }) => {
    const btn = page.locator('.space-y-6 button').filter({ hasText: '知识点管理' }).first();
    await expect(btn).toBeDisabled();
  });

  // ============================================================
  // SECTION 2: TEXTBOOK CRUD
  // ============================================================

  test('2.1 - 创建新教材（带学科下拉）', async ({ page }) => {
    const timestamp = Date.now();
    const uniqueName = `E2E测试教材-数学-${timestamp}`;
    const res = await apiCall(page, 'POST', '/api/admin/textbooks', {
      name: uniqueName,
      grade: 8,
      subject: '数学',
      year: '2024',
      publisher: 'E2E出版社'
    });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.name).toBe(uniqueName);

    // Reload and verify it appears in the list
    await page.reload();
    await clickSidebarNav(page, '知识点管理');
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 5000 });
  });

  test('2.2 - 教材列表显示年级和学科标签', async ({ page }) => {
    await expect(page.locator('text=8年级 · 数学').first()).toBeVisible({ timeout: 5000 });
  });

  test('2.3 - 选中教材后章节管理子标签启用', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    const btn = page.locator('.space-y-6 button').filter({ hasText: '章节管理' }).first();
    await expect(btn).toBeEnabled();
  });

  test('2.4 - 学科下拉包含多个学科选项', async ({ page }) => {
    await openCreateModal(page, '教材');
    const subjectSelect = page.locator('select').first();
    await expect(subjectSelect).toBeVisible();
    const count = await subjectSelect.locator('option').count();
    expect(count).toBeGreaterThan(4);
    await page.locator('button:has-text("取消")').first().click();
    await expect(page.locator('h4:has-text("新建教材")')).not.toBeVisible({ timeout: 3000 });
  });

  // ============================================================
  // SECTION 3: CHAPTER CRUD
  // ============================================================

  test('3.1 - 选中教材后切换到章节管理', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await expect(page.locator('h3:has-text("章节管理")')).toBeVisible();
  });

  test('3.2 - 创建新章节', async ({ page }) => {
    // Get textbook list to find first textbook id
    const tbListRes = await apiCall(page, 'GET', '/api/admin/textbooks');
    expect(tbListRes.status).toBe(200);
    expect(tbListRes.data.success).toBe(true);
    expect(tbListRes.data.data.length).toBeGreaterThan(0);
    const firstTbId = tbListRes.data.data[0].id;

    // Create chapter
    const chRes = await apiCall(page, 'POST', '/api/admin/chapters', {
      textbookId: firstTbId,
      chapterNumber: 1,
      chapterName: 'E2E测试章节'
    });
    expect(chRes.status).toBe(200);
    expect(chRes.data.success).toBe(true);

    // Reload and verify via UI
    await page.reload();
    await clickSidebarNav(page, '知识点管理');
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await expect(page.locator('text=第1章 E2E测试章节').first()).toBeVisible({ timeout: 5000 });
  });

  test('3.3 - 章节列表显示知识点数量', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await expect(page.locator('text=第1章 E2E测试章节').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=0 知识点').first()).toBeVisible();
  });

  test('3.4 - 选中章节后知识点管理子标签启用', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await page.locator('.bg-surface-container.rounded-xl.cursor-pointer').first().click();
    const btn = page.locator('.space-y-6 button').filter({ hasText: '知识点管理' }).first();
    await expect(btn).toBeEnabled();
  });

  // ============================================================
  // SECTION 4: KNOWLEDGE POINT CRUD
  // ============================================================

  test('4.1 - 知识点表单包含概念下拉和权重字段', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await page.locator('.bg-surface-container.rounded-xl.cursor-pointer').first().click();
    await clickSubtab(page, '知识点管理');
    await expect(page.locator('h3:has-text("知识点管理")')).toBeVisible();

    await openCreateModal(page, '知识点');

    await expect(page.locator('input[placeholder="知识点名称"]')).toBeVisible();
    await expect(page.locator('select').last()).toBeVisible(); // concept dropdown
    await expect(page.locator('input[type="number"]').last()).toBeVisible(); // weight input

    await page.locator('button:has-text("取消")').first().click();
  });

  test('4.2 - 创建知识点后出现在表格中', async ({ page }) => {
    // Get IDs via browser-context API calls
    const tbListRes = await apiCall(page, 'GET', '/api/admin/textbooks');
    const firstTbId = tbListRes.data.data[0].id;

    const chListRes = await apiCall(page, 'GET', `/api/admin/chapters?textbookId=${firstTbId}`);
    const firstChId = chListRes.data.data[0].id;

    const conceptListRes = await apiCall(page, 'GET', '/api/admin/concepts');
    // If no concepts exist, create one via UI or API
    if (!conceptListRes.data.data || conceptListRes.data.data.length === 0) {
      // Create a concept via direct API (browsers fetch with cookies + credentials)
      const createConceptRes = await apiCall(page, 'POST', '/api/admin/concepts', {
        name: 'E2E概念-代数',
        category: '代数',
        weight: 10
      });
      expect(createConceptRes.status).toBe(200);
      expect(createConceptRes.data.success).toBe(true);
      const conceptId = createConceptRes.data.data.id;

      const kpRes = await apiCall(page, 'POST', '/api/admin/knowledge-points', {
        name: 'E2E知识点-二次函数',
        chapterId: firstChId,
        conceptId: conceptId,
        weight: 15,
        inAssess: true,
        status: 'active'
      });
      expect(kpRes.status).toBe(200);
      expect(kpRes.data.success).toBe(true);
    } else {
      const firstConceptId = conceptListRes.data.data[0].id;

      const kpRes = await apiCall(page, 'POST', '/api/admin/knowledge-points', {
        name: 'E2E知识点-二次函数',
        chapterId: firstChId,
        conceptId: firstConceptId,
        weight: 15,
        inAssess: true,
        status: 'active'
      });
      expect(kpRes.status).toBe(200);
      expect(kpRes.data.success).toBe(true);
    }

    // Reload and verify in table
    await page.reload();
    await clickSidebarNav(page, '知识点管理');
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await page.locator('.bg-surface-container.rounded-xl.cursor-pointer').first().click();
    await clickSubtab(page, '知识点管理');

    await expect(page.locator('table >> text=E2E知识点-二次函数').first()).toBeVisible({ timeout: 5000 });
  });

  test('4.3 - 表格显示概念名称列和混合权重', async ({ page }) => {
    await page.locator('.bg-surface-container.rounded-2xl.cursor-pointer').first().click();
    await clickSubtab(page, '章节管理');
    await page.locator('.bg-surface-container.rounded-xl.cursor-pointer').first().click();
    await clickSubtab(page, '知识点管理');

    const table = page.locator('table');
    await expect(table).toBeVisible();

    const headerTexts = await table.locator('thead th').allInnerTexts();
    expect(headerTexts.join('|')).toMatch(/名称/);
    expect(headerTexts.join('|')).toMatch(/概念/);
    expect(headerTexts.join('|')).toMatch(/权重/);

    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    const conceptCell = rows.first().locator('td').nth(1);
    await expect(conceptCell).not.toBeEmpty();

    const weightCell = rows.first().locator('td').nth(2);
    await expect(weightCell).toContainText(/\d+/);
  });

  // ============================================================
  // SECTION 5: WEIGHT VALIDATION
  // ============================================================

  test('5.1 - 分数地图显示权重平衡状态指示器', async ({ page }) => {
    await clickSidebarNav(page, '分数地图');
    await expect(page.locator('text=/分值.*平衡/').first()).toBeVisible({ timeout: 5000 });
  });

  test('5.2 - Dashboard 显示权重总和', async ({ page }) => {
    await clickSidebarNav(page, 'Dashboard');
    await expect(page.locator('text=权重总和').first()).toBeVisible({ timeout: 5000 });
  });

  // ============================================================
  // SECTION 6: DELETE PROTECTION
  // ============================================================

  test('6.1 - 有章节的教材删除应被阻止', async ({ page }) => {
    // Create textbook with unique name
    const timestamp = Date.now();
    const uniqueName = `删除保护教材-${timestamp}`;
    const tbRes = await apiCall(page, 'POST', '/api/admin/textbooks', {
      name: uniqueName, grade: 9, subject: '数学'
    });
    expect(tbRes.status).toBe(200);
    expect(tbRes.data.success).toBe(true);
    const tbId = tbRes.data.data.id;

    // Create chapter
    const chRes = await apiCall(page, 'POST', '/api/admin/chapters', {
      textbookId: tbId,
      chapterNumber: 99,
      chapterName: '保护测试章节'
    });
    expect(chRes.status).toBe(200);
    expect(chRes.data.success).toBe(true);

    // Attempt to delete textbook — should either return error or succeed but textbook still exists
    const delRes = await apiCall(page, 'DELETE', `/api/admin/textbooks/${tbId}`);

    if (delRes.status >= 200 && delRes.status < 300) {
      // If delete succeeded, verify textbook was NOT actually removed
      const remaining = await apiCall(page, 'GET', '/api/admin/textbooks');
      const stillExists = remaining.data.data.some((t: any) => t.id === tbId);
      expect(stillExists).toBe(true);
    } else {
      // Non-2xx means API blocked the delete — expected
      expect(delRes.data).toHaveProperty('error');
    }
  });
});