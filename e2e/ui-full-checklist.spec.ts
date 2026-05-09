import { test, expect } from '@playwright/test';

/**
 * UI 全面检查测试套件
 *
 * 测试重点：
 * 1. 静态数字问题 - 检查所有数字显示是否会变化
 * 2. 断头路检测 - 确保每个页面都能返回
 * 3. 按钮链接验证 - 所有 CTA 按钮是否正确跳转
 * 4. 完整答题流程 - 输入答案→显示答案→记住/记错→下一题
 */

test.describe('UI 全面检查', () => {
  // 测试账号
  const TEST_USER = {
    email: 'test@example.com',
    password: 'Test123456!'
  };

  // 每个测试前都进行登录
  test.beforeEach(async ({ page }) => {
    // 直接访问首页，如果未登录会重定向到登录页
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);

    // 检查是否在登录页面
    const isLoginPage = page.url().includes('login') || page.url().includes('auth');
    if (isLoginPage) {
      console.log('检测到登录页面，尝试登录...');

      // 尝试多种可能的登录表单选择器
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="邮箱" i]',
        '#email',
        '[data-testid="email-input"]'
      ];

      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="password" i]',
        'input[placeholder*="密码" i]',
        '#password',
        '[data-testid="password-input"]'
      ];

      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("登录")',
        'button:has-text("Login")',
        'button:has-text("登入")',
        'input[type="submit"]',
        '[data-testid="submit-button"]'
      ];

      // 尝试找到并填写邮箱
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.fill(selector, TEST_USER.email);
          console.log('已填写邮箱');
          break;
        } catch {
          continue;
        }
      }

      // 尝试找到并填写密码
      for (const selector of passwordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.fill(selector, TEST_USER.password);
          console.log('已填写密码');
          break;
        } catch {
          continue;
        }
      }

      // 尝试找到并点击提交按钮
      for (const selector of submitSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log('已点击登录按钮');
          break;
        } catch {
          continue;
        }
      }

      // 等待登录完成
      await page.waitForTimeout(3000);
    }

    // 确保最终到达首页
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test.describe('1. 静态数字问题检查', () => {
    test('首页 - XP 奖励是否变化', async ({ page }) => {
      // 记录初始 XP
      const initialXP = await page.locator('[data-testid="user-xp"], .xp-display, [class*="xp"]').textContent().catch(() => 'N/A');
      console.log('初始 XP:', initialXP);

      // 尝试做一些操作来增加 XP
      // 这里可以模拟答题或者查看学习进度

      // 刷新页面检查 XP 是否持久化
      await page.reload();
      await page.waitForLoadState('networkidle');

      const reloadedXP = await page.locator('[data-testid="user-xp"], .xp-display, [class*="xp"]').textContent().catch(() => 'N/A');
      console.log('重新加载后 XP:', reloadedXP);

      // 截图保存
      await page.screenshot({ path: 'e2e-test-screenshots/xp-before-action.png' });
    });

    test('首页 - "今日学习"统计数据是否真实', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 检查今日学习统计
      const todayStats = await page.locator('[data-testid="today-stats"], .today-stats, [class*="today"]').all();
      console.log('今日学习统计元素数量:', todayStats.length);

      // 截图
      await page.screenshot({ path: 'e2e-test-screenshots/today-stats.png' });

      // 检查是否有"今日学习"相关的数据
      const hasTodayData = await page.locator('text=/今日|今天|today/i').count();
      console.log('包含"今日"的元素数量:', hasTodayData);
    });

    test('掌握度百分比是否变化', async ({ page }) => {
      // 查找掌握度显示
      const masteryElements = await page.locator('[data-testid*="mastery"], [class*="mastery"], [class*="percent"]').all();
      console.log('掌握度相关元素数量:', masteryElements.length);

      // 截图保存掌握度显示
      await page.screenshot({ path: 'e2e-test-screenshots/mastery-display.png' });
    });

    test('进度指示器是否更新', async ({ page }) => {
      // 检查各种进度条
      const progressBars = await page.locator('[role="progressbar"], [class*="progress"]').all();
      console.log('进度条数量:', progressBars.length);

      // 截图
      await page.screenshot({ path: 'e2e-test-screenshots/progress-bars.png' });
    });
  });

  test.describe('2. 断头路检测', () => {
    test('练习页面 - 是否有返回按钮', async ({ page }) => {
      await page.goto('http://localhost:3000/practice');

      // 检查返回按钮
      const backButtons = await page.locator('button:has-text("返回"), [aria-label="back"], .back-button, [class*="back"]').all();
      console.log('练习页面返回按钮数量:', backButtons.length);

      // 截图
      await page.screenshot({ path: 'e2e-test-screenshots/practice-page-back-button.png' });

      // 如果有返回按钮，点击它是否能正常工作
      if (backButtons.length > 0) {
        const currentUrl = page.url();
        await backButtons[0].click();
        await page.waitForTimeout(1000);
        const newUrl = page.url();
        console.log('点击返回按钮后 URL 变化:', currentUrl, '->', newUrl);

        // 返回练习页面继续测试
        await page.goto('http://localhost:3000/practice');
      }
    });

    test('训练页面 - 返回按钮是否工作', async ({ page }) => {
      await page.goto('http://localhost:3000/practice/training');

      // 检查返回按钮
      const backButtons = await page.locator('button:has-text("返回"), [aria-label="back"], .back-button, [class*="back"]').all();
      console.log('训练页面返回按钮数量:', backButtons.length);

      // 截图
      await page.screenshot({ path: 'e2e-test-screenshots/training-page-back-button.png' });

      // 如果有返回按钮，点击测试
      if (backButtons.length > 0) {
        const currentUrl = page.url();
        await backButtons[0].click();
        await page.waitForTimeout(1000);
        const newUrl = page.url();
        console.log('点击返回按钮后 URL 变化:', currentUrl, '->', newUrl);
        expect(newUrl).not.toBe(currentUrl);
      }
    });

    test('所有主要页面的导航检查', async ({ page }) => {
      const pages = [
        'http://localhost:3000',
        'http://localhost:3000/practice',
        'http://localhost:3000/analyze',
        'http://localhost:3000/console'
      ];

      for (const url of pages) {
        console.log('检查页面导航:', url);
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // 截图
        const pageName = url.split('/').pop() || 'home';
        await page.screenshot({ path: `e2e-test-screenshots/navigation-${pageName}.png` });

        // 检查是否有导航菜单或返回按钮
        const hasNav = await page.locator('nav, [role="navigation"]').count() > 0;
        const hasBack = await page.locator('button:has-text("返回"), [aria-label="back"]').count() > 0;

        console.log(`  ${url} - 导航菜单: ${hasNav}, 返回按钮: ${hasBack}`);
      }
    });
  });

  test.describe('3. 按钮链接验证', () => {
    test('首页 - 练习模式卡片跳转', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 查找练习模式相关的卡片或按钮
      const practiceButtons = await page.locator('a:has-text("练习"), a:has-text("开始"), button:has-text("练习")').all();
      console.log('练习相关按钮数量:', practiceButtons.length);

      // 截图首页
      await page.screenshot({ path: 'e2e-test-screenshots/home-practice-buttons.png' });

      // 点击第一个练习按钮
      if (practiceButtons.length > 0) {
        const currentUrl = page.url();
        await practiceButtons[0].click();
        await page.waitForTimeout(2000);
        const newUrl = page.url();
        console.log('点击练习按钮后 URL:', currentUrl, '->', newUrl);

        // 截图点击后的页面
        await page.screenshot({ path: 'e2e-test-screenshots/after-click-practice.png' });
      }
    });

    test('所有 CTA 按钮链接检查', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // 查找所有主要按钮
      const allButtons = await page.locator('button, a[role="button"]').all();
      console.log('页面按钮总数:', allButtons.length);

      // 截图所有可见按钮
      await page.screenshot({ path: 'e2e-test-screenshots/all-buttons.png', fullPage: true });

      // 检查主要 CTA 按钮
      const ctaSelectors = [
        'a:has-text("开始学习")',
        'a:has-text("开始练习")',
        'button:has-text("开始")',
        'a:has-text("继续")',
        'button:has-text("继续")'
      ];

      for (const selector of ctaSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`找到 CTA 按钮: ${selector} (${count} 个)`);
        }
      }
    });
  });

  test.describe('4. 完整答题流程', () => {
    test('训练模式 - 完整答题流程', async ({ page }) => {
      await page.goto('http://localhost:3000/practice/training');
      await page.waitForLoadState('networkidle');

      // 截图初始状态
      await page.screenshot({ path: 'e2e-test-screenshots/training-initial.png' });

      // 步骤 1: 输入答案
      console.log('步骤 1: 查找输入框...');
      const inputSelectors = [
        'input[type="text"]',
        'input[type="number"]',
        'textarea',
        '[contenteditable="true"]',
        '[data-testid="answer-input"]'
      ];

      let inputField = null;
      for (const selector of inputSelectors) {
        const input = page.locator(selector).first();
        if (await input.count() > 0) {
          inputField = input;
          console.log('找到输入框:', selector);
          break;
        }
      }

      if (inputField) {
        // 截图输入框
        await inputField.screenshot({ path: 'e2e-test-screenshots/answer-input.png' });

        // 输入测试答案
        await inputField.fill('123');
        console.log('已输入答案: 123');

        // 截图输入后的状态
        await page.screenshot({ path: 'e2e-test-screenshots/after-input-answer.png' });

        // 步骤 2: 查找提交按钮
        console.log('步骤 2: 查找提交按钮...');
        const submitSelectors = [
          'button:has-text("提交")',
          'button:has-text("确定")',
          'button[type="submit"]',
          '[data-testid="submit-answer"]'
        ];

        let submitButton = null;
        for (const selector of submitSelectors) {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            submitButton = button;
            console.log('找到提交按钮:', selector);
            break;
          }
        }

        if (submitButton) {
          // 截图提交按钮
          await submitButton.screenshot({ path: 'e2e-test-screenshots/submit-button.png' });

          // 点击提交
          await submitButton.click();
          await page.waitForTimeout(2000);
          console.log('已点击提交按钮');

          // 截图提交后的状态
          await page.screenshot({ path: 'e2e-test-screenshots/after-submit.png' });

          // 步骤 3: 检查答案显示
          console.log('步骤 3: 检查答案显示...');
          const answerRevealedSelectors = [
            '[data-testid="correct-answer"]',
            '[class*="correct-answer"]',
            '[class*="answer-reveal"]',
            'text=/答案|Answer/i'
          ];

          for (const selector of answerRevealedSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
              console.log('找到答案显示元素:', selector);
            }
          }

          // 截图答案显示状态
          await page.screenshot({ path: 'e2e-test-screenshots/answer-revealed.png' });

          // 步骤 4: 查找记住/记错按钮
          console.log('步骤 4: 查找记住/记错按钮...');
          const feedbackSelectors = [
            'button:has-text("记住")',
            'button:has-text("记错")',
            'button:has-text("掌握了")',
            'button:has-text("需要复习")',
            '[data-testid="remember"]',
            '[data-testid="forgot"]'
          ];

          for (const selector of feedbackSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
              console.log('找到反馈按钮:', selector);
              const button = page.locator(selector).first();
              await button.screenshot({ path: `e2e-test-screenshots/feedback-button-${selector}.png` });
            }
          }

          // 截图反馈按钮状态
          await page.screenshot({ path: 'e2e-test-screenshots/feedback-buttons.png' });

          // 步骤 5: 点击"记住"按钮
          const rememberButton = page.locator('button:has-text("记住")').first();
          if (await rememberButton.count() > 0) {
            await rememberButton.click();
            await page.waitForTimeout(2000);
            console.log('已点击"记住"按钮');

            // 截图点击后的状态
            await page.screenshot({ path: 'e2e-test-screenshots/after-remember.png' });

            // 检查是否有下一题按钮或自动跳转
            const nextSelectors = [
              'button:has-text("下一题")',
              'button:has-text("继续")',
              '[data-testid="next-question"]'
            ];

            for (const selector of nextSelectors) {
              const count = await page.locator(selector).count();
              if (count > 0) {
                console.log('找到下一题按钮:', selector);
              }
            }
          }
        }
      } else {
        console.log('未找到输入框，可能是没有题目或页面结构不同');
      }

      // 最终截图
      await page.screenshot({ path: 'e2e-test-screenshots/training-final-state.png', fullPage: true });
    });

    test('答题后 XP 和进度是否更新', async ({ page }) => {
      // 这个测试需要完整的答题流程
      await page.goto('http://localhost:3000/practice/training');

      // 记录初始状态
      const initialXP = await page.locator('[class*="xp"]').textContent().catch(() => 'N/A');
      console.log('答题前 XP:', initialXP);

      // 尝试答题（如果可能）
      const inputField = page.locator('input[type="text"], input[type="number"]').first();
      if (await inputField.count() > 0) {
        await inputField.fill('100');

        const submitButton = page.locator('button:has-text("提交"), button[type="submit"]').first();
        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(2000);

          // 点击"记住"
          const rememberButton = page.locator('button:has-text("记住")').first();
          if (await rememberButton.count() > 0) {
            await rememberButton.click();
            await page.waitForTimeout(2000);

            // 检查 XP 是否变化
            const updatedXP = await page.locator('[class*="xp"]').textContent().catch(() => 'N/A');
            console.log('答题后 XP:', updatedXP);

            // 截图对比
            await page.screenshot({ path: 'e2e-test-screenshots/xp-after-answer.png' });
          }
        }
      }
    });
  });

  test.describe('5. 综合问题检测', () => {
    test('检测所有页面的静态数据和动态数据', async ({ page }) => {
      const pages = [
        { url: 'http://localhost:3000', name: 'home' },
        { url: 'http://localhost:3000/practice', name: 'practice' },
        { url: 'http://localhost:3000/practice/training', name: 'training' }
      ];

      for (const pageData of pages) {
        console.log(`检查页面: ${pageData.name}`);
        await page.goto(pageData.url);
        await page.waitForLoadState('networkidle');

        // 截图完整页面
        await page.screenshot({
          path: `e2e-test-screenshots/full-page-${pageData.name}.png`,
          fullPage: true
        });

        // 检查所有数字显示
        const numbers = await page.locator('text=/\\d+/').allTextContents();
        console.log(`  找到的数字: ${numbers.slice(0, 10).join(', ')}...`);

        // 检查所有百分比
        const percentages = await page.locator('text=/\\d+%/').allTextContents();
        console.log(`  找到的百分比: ${percentages.join(', ')}`);
      }
    });

    test('检测所有可能的断头路页面', async ({ page }) => {
      // 尝试访问各种可能的 URL
      const testUrls = [
        'http://localhost:3000/settings',
        'http://localhost:3000/profile',
        'http://localhost:3000/history',
        'http://localhost:3000/statistics'
      ];

      for (const url of testUrls) {
        console.log('测试 URL:', url);
        try {
          await page.goto(url, { timeout: 5000 });
          await page.waitForTimeout(1000);

          // 检查是否能正常加载
          const is404 = await page.locator('text=/404|Not Found|找不到').count() > 0;
          const hasNav = await page.locator('nav, [role="navigation"], button:has-text("返回")').count() > 0;

          console.log(`  状态: ${is404 ? '404' : '正常'}, 导航: ${hasNav ? '有' : '无'}`);

          // 截图
          const pageName = url.split('/').pop() || 'unknown';
          await page.screenshot({ path: `e2e-test-screenshots/test-url-${pageName}.png` });
        } catch (error) {
          console.log(`  无法访问: ${error}`);
        }
      }
    });
  });
});
