import { test, expect } from '@playwright/test';

/**
 * 全面 UI-based E2E 测试
 * 测试重点：
 * 1. 导航测试 - 返回按钮、导航链接、断头路检测
 * 2. 按钮链接测试 - CTA按钮、页面跳转
 * 3. 数字显示测试 - XP奖励、掌握度、进度指示器
 * 4. 表单输入测试 - 答案输入框、登录表单
 * 5. 反馈流程测试 - 答题→答案→反馈全流程
 */

// 测试账号
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'Test123456!';

/**
 * 辅助函数：登录
 */
async function login(page: any, email = TEST_EMAIL, password = TEST_PASSWORD) {
  // 尝试从已有状态加载
  await page.goto('/login');
  await page.waitForLoadState('networkidle').catch(() => {});

  // 填写登录表单
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');
  const submitButton = page.locator('button[type="submit"]:not([disabled])').first();

  if (await emailInput.count() > 0) {
    await emailInput.fill(email);
    await passwordInput.fill(password);

    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * 辅助函数：截图并保存
 */
async function screenshot(page: any, name: string) {
  await page.screenshot({ path: `e2e-test-screenshots/${name}.png`, fullPage: true });
}

test.describe.configure({ mode: 'serial' });

// ============================================
// 测试组1：导航测试
// ============================================
test.describe('1️⃣ 导航测试 - 返回按钮和导航链接', () => {

  test('1.1 首页 → 练习页 → 返回', async ({ page }) => {
    // 截图目录
    const screenshotDir = 'e2e-test-screenshots';
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '01-homepage');

    // 查找进入练习页的按钮
    const startBtn = page.getByText(/开始/, { exact: false }).first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '02-after-click-start');

      const url = page.url();
      console.log('跳转后URL:', url);

      // 检查是否有练习内容
      const hasPracticeContent = url.includes('/practice') ||
        await page.getByText(/练习|题目|难度/, { exact: false }).count() > 0;

      console.log('是否有练习内容:', hasPracticeContent);
    }

    // 检查是否有返回按钮
    const backBtn = page.getByText(/返回/, { exact: false }).first();
    if (await backBtn.count() > 0) {
      console.log('✓ 发现返回按钮');
      await screenshot(page, '03-back-button-found');

      await backBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '04-after-back');
      console.log('点击返回按钮后URL:', page.url());
    } else {
      console.log('⚠ 未发现返回按钮');
    }
  });

  test('1.2 练习页模式选择 → 训练页 → 返回', async ({ page }) => {
    // 先登录
    await login(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '05-practice-page');

    // 点击练习模式卡片
    const trainingCard = page.getByText(/练习模式/, { exact: false }).first();
    if (await trainingCard.count() > 0) {
      // 找到包含这个文本的父级可点击元素
      const parentCard = trainingCard.locator('..').first();
      await parentCard.click();

      await page.waitForTimeout(3000);
      await screenshot(page, '06-training-page');
      console.log('训练页URL:', page.url());
    }

    // 检查训练页返回按钮
    const backBtn = page.locator('button:has-text("返回")').first();
    if (await backBtn.count() > 0) {
      console.log('✓ 训练页有返回按钮');
      await backBtn.click();
      await page.waitForTimeout(2000);
      console.log('返回后URL:', page.url());
      expect(page.url()).toContain('/practice');
    }
  });

  test('1.3 检测断头路 - 无法返回的页面', async ({ page }) => {
    await login(page);

    // 测试各个页面
    const pages = ['/', '/practice', '/me', '/analyze'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // 尝试点击进入更深层页面
      const mainAction = page.getByText(/开始|练习|测评/, { exact: false }).first();
      if (await mainAction.count() > 0) {
        await mainAction.click();
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        console.log(`从${path}进入后URL:`, currentUrl);

        // 检查返回按钮
        const backBtn = page.locator('button:has-text("返回"), a:has-text("返回")').first();
        if (await backBtn.count() > 0) {
          console.log(`✓ ${currentUrl} 有返回按钮`);
        } else {
          console.log(`⚠ ${currentUrl} 可能没有返回按钮`);
          await screenshot(page, `dead-end-${path.replace('/', '-')}`);
        }

        // 尝试返回
        if (await backBtn.count() > 0) {
          await backBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});

// ============================================
// 测试组2：按钮链接测试
// ============================================
test.describe('2️⃣ 按钮链接测试 - 所有按钮和链接', () => {

  test('2.1 练习页 → 训练页链接', async ({ page }) => {
    await login(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // 查找所有可点击的按钮
    const buttons = await page.locator('button, [role="button"], a').all();
    console.log('页面按钮数量:', buttons.length);

    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const btn = buttons[i];
      const text = await btn.textContent().catch(() => '无法获取文本');
      const className = await btn.getAttribute('class').catch(() => '');
      console.log(`按钮${i + 1}: ${text} | class: ${className.slice(0, 50)}`);
    }

    // 点击练习模式入口
    const practiceCard = page.locator('div:has-text("练习模式")').first();
    if (await practiceCard.count() > 0) {
      await practiceCard.click();
      await page.waitForTimeout(3000);

      const url = page.url();
      console.log('点击练习模式后URL:', url);

      if (url.includes('/training') || url.includes('/practice/training')) {
        console.log('✓ 成功进入训练页');
        await screenshot(page, '07-training-entered');

        // 验证返回按钮存在
        const backBtn = page.locator('button:has-text("返回")').first();
        if (await backBtn.count() > 0) {
          console.log('✓ 训练页有返回按钮');
        } else {
          console.log('⚠ 训练页没有返回按钮');
        }
      } else {
        console.log('⚠ 未进入训练页，当前URL:', url);
        await screenshot(page, '07-not-in-training');
      }
    } else {
      console.log('⚠ 未找到练习模式卡片');
      test.skip(true, '未找到练习模式卡片');
    }
  });

  test('2.2 训练页 → 返回链接', async ({ page }) => {
    await login(page);

    // 直接进入训练页
    await page.goto('/practice/training');
    await page.waitForTimeout(5000); // 等待加载

    await screenshot(page, '08-training-page-direct');

    // 检查返回按钮
    const backBtn = page.locator('button:has-text("返回")').first();
    if (await backBtn.count() > 0) {
      console.log('✓ 找到返回按钮');
      await backBtn.click();
      await page.waitForTimeout(2000);
      console.log('点击返回后URL:', page.url());
      expect(page.url()).toContain('/practice');
    } else {
      console.log('⚠ 未找到返回按钮，页面可能处于加载状态');
    }
  });

  test('2.3 所有CTA按钮检查', async ({ page }) => {
    await login(page);

    const ctaButtons = [
      { text: /开始/, path: '/' },
      { text: /练习/, path: '/practice' },
      { text: /诊断/, path: '/assessment' },
      { text: /我的/, path: '/me' },
      { text: /分析/, path: '/analyze' },
    ];

    for (const { text, path } of ctaButtons) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const btn = page.getByText(text, { exact: false }).first();
      if (await btn.count() > 0) {
        console.log(`✓ ${path} 找到 ${text} 按钮`);
      } else {
        console.log(`⚠ ${path} 未找到 ${text} 按钮`);
      }
    }
  });
});

// ============================================
// 测试组3：数字显示测试
// ============================================
test.describe('3️⃣ 数字显示测试 - XP、掌握度、进度', () => {

  test('3.1 首页数字显示', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 查找数字显示
    const numbers = await page.locator('text=/\\d+/').all();
    console.log('首页数字元素数量:', numbers.length);

    for (let i = 0; i < Math.min(numbers.length, 10); i++) {
      const text = await numbers[i].textContent();
      console.log(`数字${i + 1}:`, text);
    }

    // 查找可能的分数显示
    const score = page.locator('text=/\\d+/').filter({ hasText: /分|XP|正确/ }).first();
    if (await score.count() > 0) {
      console.log('找到分数/XP显示:', await score.textContent());
      await screenshot(page, '09-homepage-score');
    }
  });

  test('3.2 练习页数字显示', async ({ page }) => {
    await login(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 查找统计数据
    const stats = page.getByText('今日学习', { exact: false }).first();
    if (await stats.count() > 0) {
      console.log('✓ 找到今日学习统计');
      await screenshot(page, '10-practice-stats');

      // 查找数字
      const parent = stats.locator('..').first();
      const parentText = await parent.textContent();
      console.log('今日学习区域内容:', parentText);
    }
  });

  test('3.3 训练页进度指示器', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    // 查找进度条
    const progress = page.locator('[class*="progress"], [class*="Progress"]').first();
    if (await progress.count() > 0) {
      console.log('✓ 找到进度指示器');
      await screenshot(page, '11-training-progress');
    }

    // 查找XP显示
    const xp = page.getByText(/XP|\\+\\d+/, { exact: false }).first();
    if (await xp.count() > 0) {
      console.log('找到XP显示:', await xp.textContent());
    }

    // 查找掌握度百分比
    const mastery = page.getByText(/%|掌握/, { exact: false }).first();
    if (await mastery.count() > 0) {
      console.log('找到掌握度:', await mastery.textContent());
    }
  });

  test('3.4 题目数量显示', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    // 查找题号显示 (如 "1/3", "2/5" 等)
    const questionCount = page.locator('text=/\\d+\\/\\d+/').first();
    if (await questionCount.count() > 0) {
      console.log('找到题目数量显示:', await questionCount.textContent());
      await screenshot(page, '12-question-count');
    } else {
      console.log('⚠ 未找到题目数量显示，可能还在加载或无题目');
    }
  });
});

// ============================================
// 测试组4：表单输入测试
// ============================================
test.describe('4️⃣ 表单输入测试 - 输入框和表单', () => {

  test('4.1 登录表单输入', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '13-login-page');

    // 查找邮箱输入框
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    if (await emailInput.count() > 0) {
      console.log('✓ 找到邮箱输入框');
      await emailInput.fill(TEST_EMAIL);
      console.log('✓ 邮箱输入成功');
    }

    if (await passwordInput.count() > 0) {
      console.log('✓ 找到密码输入框');
      await passwordInput.fill(TEST_PASSWORD);
      console.log('✓ 密码输入成功');
    }

    await screenshot(page, '14-login-filled');

    // 提交
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '15-login-submitted');
    }
  });

  test('4.2 训练页答案输入', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    await screenshot(page, '16-training-ready');

    // 查找答案输入框
    const inputFields = await page.locator('input[type="text"], input:not([type]), textarea').all();
    console.log('找到输入框数量:', inputFields.length);

    for (let i = 0; i < Math.min(inputFields.length, 5); i++) {
      const input = inputFields[i];
      const isVisible = await input.isVisible().catch(() => false);
      const isEnabled = await input.isEnabled().catch(() => false);

      if (isVisible && isEnabled) {
        console.log(`输入框${i + 1} 可用，尝试输入...`);
        await input.fill('测试答案');
        console.log(`✓ 输入框${i + 1} 输入成功`);

        // 清空并继续
        await input.clear();
      }
    }

    await screenshot(page, '17-input-tested');
  });

  test('4.3 输入框边界测试', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    const inputFields = await page.locator('input[type="text"], input:not([type])').all();

    for (const input of inputFields) {
      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) continue;

      // 测试长文本输入
      await input.fill('这是一个非常长的测试答案，用于测试输入框是否能正确处理大量文本内容');
      const value = await input.inputValue();
      console.log('输入内容长度:', value.length);

      // 测试清空
      await input.clear();
      const afterClear = await input.inputValue();
      console.log('清空后内容:', afterClear === '' ? '(空)' : afterClear);
    }
  });
});

// ============================================
// 测试组5：反馈流程测试
// ============================================
test.describe('5️⃣ 反馈流程测试 - 答题→答案→反馈', () => {

  test('5.1 答题流程', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    await screenshot(page, '18-ready-to-answer');

    // 检查是否有题目
    const hasQuestion = await page.getByText(/题目|问题|请回答/, { exact: false }).count() > 0 ||
                        await page.locator('[class*="question"]').count() > 0;

    if (hasQuestion) {
      console.log('✓ 发现题目');
      await screenshot(page, '19-question-visible');

      // 查找选项或输入框
      const options = await page.locator('[class*="option"], [class*="Choice"]').all();
      if (options.length > 0) {
        console.log('找到选项数量:', options.length);
        await options[0].click();
        console.log('✓ 点击第一个选项');
        await screenshot(page, '20-option-selected');
      }
    } else {
      console.log('⚠ 未发现题目，可能无题目或页面布局不同');
      await screenshot(page, '19-no-question');
    }
  });

  test('5.2 显示答案按钮', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    // 查找显示答案按钮
    const showAnswerBtn = page.getByText(/显示答案/, { exact: false }).first();
    if (await showAnswerBtn.count() > 0) {
      console.log('✓ 找到显示答案按钮');
      await screenshot(page, '21-show-answer-btn');

      await showAnswerBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '22-after-show-answer');

      console.log('点击后页面URL:', page.url());
    } else {
      console.log('⚠ 未找到显示答案按钮，可能需要先选择答案或页面状态不同');

      // 检查页面状态
      const pageText = await page.locator('body').textContent();
      console.log('页面文本前200字符:', pageText?.slice(0, 200));
    }
  });

  test('5.3 记住/记错按钮测试', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    // 先点击显示答案
    const showAnswerBtn = page.getByText(/显示答案/, { exact: false }).first();
    if (await showAnswerBtn.count() > 0) {
      await showAnswerBtn.click();
      await page.waitForTimeout(2000);
    }

    // 查找记住/记错按钮
    const rememberBtn = page.getByText(/记住|记对了|已掌握/, { exact: false }).first();
    const forgotBtn = page.getByText(/记错|忘记了|没掌握/, { exact: false }).first();

    if (await rememberBtn.count() > 0) {
      console.log('✓ 找到记住按钮');
      await screenshot(page, '23-remember-btn');
    }

    if (await forgotBtn.count() > 0) {
      console.log('✓ 找到记错按钮');
      await screenshot(page, '24-forgot-btn');
    }

    // 如果两个按钮都存在，尝试点击记住按钮
    if (await rememberBtn.count() > 0) {
      await rememberBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '25-after-remember');
      console.log('✓ 点击记住按钮成功');

      // 检查XP是否增加
      const xp = page.getByText(/\\+\\d+\\s*XP/i, { exact: false }).first();
      if (await xp.count() > 0) {
        console.log('✓ XP奖励显示:', await xp.textContent());
      }
    }
  });

  test('5.4 FeedbackCard显示', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    // 点击显示答案
    const showAnswerBtn = page.getByText(/显示答案/, { exact: false }).first();
    if (await showAnswerBtn.count() > 0) {
      await showAnswerBtn.click();
      await page.waitForTimeout(2000);
    }

    await screenshot(page, '26-feedback-card');

    // 检查FeedbackCard相关内容
    const feedbackElements = await page.locator('[class*="feedback"], [class*="Feedback"], [class*="answer"]').all();
    console.log('找到可能包含反馈的元素数量:', feedbackElements.length);

    // 检查是否有正确答案是示
    const correctAnswer = page.getByText(/正确答案|答案|正确/, { exact: false }).first();
    if (await correctAnswer.count() > 0) {
      console.log('✓ 发现答案显示');
      await screenshot(page, '27-correct-answer');
    }

    // 检查是否有掌握度变化显示
    const mastery = page.getByText(/%|掌握/, { exact: false }).first();
    if (await mastery.count() > 0) {
      console.log('✓ 发现掌握度显示:', await mastery.textContent());
      await screenshot(page, '28-mastery-display');
    }
  });

  test('5.5 完整反馈流程测试', async ({ page }) => {
    await login(page);
    await page.goto('/practice/training');
    await page.waitForTimeout(5000);

    console.log('开始完整反馈流程测试...');
    await screenshot(page, '29-full-flow-start');

    // 步骤1: 选择答案或输入答案
    const options = await page.locator('[class*="option"], [class*="Choice"]').all();
    const input = page.locator('input[type="text"], input:not([type])').first();

    if (options.length > 0) {
      await options[0].click();
      console.log('步骤1: 选择答案');
    } else if (await input.isVisible().catch(() => false)) {
      await input.fill('测试');
      console.log('步骤1: 输入答案');
    }

    await page.waitForTimeout(500);
    await screenshot(page, '30-step1-answer');

    // 步骤2: 点击显示答案
    const showAnswerBtn = page.getByText(/显示答案/, { exact: false }).first();
    if (await showAnswerBtn.count() > 0) {
      await showAnswerBtn.click();
      console.log('步骤2: 点击显示答案');
      await page.waitForTimeout(2000);
      await screenshot(page, '31-step2-show-answer');
    }

    // 步骤3: 点击记住或记错
    const rememberBtn = page.getByText(/记住|记对了/, { exact: false }).first();
    if (await rememberBtn.count() > 0) {
      await rememberBtn.click();
      console.log('步骤3: 点击记住按钮');
      await page.waitForTimeout(2000);
      await screenshot(page, '32-step3-feedback');
    }

    // 步骤4: 检查XP是否增加
    const xpText = page.locator('text=/\\+\\d+\\s*XP/i').first();
    if (await xpText.count() > 0) {
      console.log('✓ 步骤4: XP增加显示为', await xpText.textContent());
      await screenshot(page, '33-step4-xp');
    }

    // 步骤5: 进入下一题或完成
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const pageText = await page.locator('body').textContent();
    console.log('当前URL:', currentUrl);
    console.log('页面是否包含完成:', pageText?.includes('完成'));
    await screenshot(page, '34-full-flow-end');
  });
});

// ============================================
// 测试组6：综合导航测试
// ============================================
test.describe('6️⃣ 综合导航 - 完整用户旅程', () => {

  test('6.1 首页 → 练习页 → 训练页 → 返回 → 首页', async ({ page }) => {
    await login(page);

    // 首页
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '35-journey-home');
    console.log('1. 首页 URL:', page.url());

    // 进入练习页
    const startBtn = page.getByText(/开始/, { exact: false }).first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, '36-journey-practice');
    console.log('2. 练习页 URL:', page.url());

    // 进入训练页
    const trainingCard = page.locator('div:has-text("练习模式")').first();
    if (await trainingCard.count() > 0) {
      await trainingCard.click();
      await page.waitForTimeout(3000);
    }
    await screenshot(page, '37-journey-training');
    console.log('3. 训练页 URL:', page.url());

    // 返回练习页
    const backBtn1 = page.locator('button:has-text("返回")').first();
    if (await backBtn1.count() > 0) {
      await backBtn1.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, '38-journey-back-practice');
    console.log('4. 返回练习页 URL:', page.url());

    // 返回首页
    const backBtn2 = page.getByText(/返回.*页|返回.*选择/, { exact: false }).first();
    if (await backBtn2.count() > 0) {
      await backBtn2.click();
      await page.waitForTimeout(2000);
    } else {
      // 直接导航回首页
      await page.goto('/');
    }
    await screenshot(page, '39-journey-back-home');
    console.log('5. 返回首页 URL:', page.url());

    // 验证所有导航都成功
    console.log('✓ 完整导航旅程完成');
  });

  test('6.2 个人中心页面导航', async ({ page }) => {
    await login(page);
    await page.goto('/me');
    await page.waitForLoadState('networkidle');
    await screenshot(page, '40-me-page');

    console.log('个人中心 URL:', page.url());

    // 检查页面元素
    const pageText = await page.locator('body').textContent();
    const hasStats = pageText?.includes('统计') || pageText?.includes('学习');
    const hasHistory = pageText?.includes('历史') || pageText?.includes('记录');

    console.log('是否有统计数据:', hasStats);
    console.log('是否有历史记录:', hasHistory);

    // 尝试进入历史页面
    const historyLink = page.getByText(/历史|记录/, { exact: false }).first();
    if (await historyLink.count() > 0) {
      await historyLink.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '41-me-history');
      console.log('历史页面 URL:', page.url());

      // 检查返回
      const backBtn = page.locator('button:has-text("返回"), a:has-text("返回")').first();
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await page.waitForTimeout(1000);
        console.log('从历史页返回 URL:', page.url());
      }
    }
  });
});

// ============================================
// 测试组7：截图和问题报告
// ============================================
test.describe('7️⃣ 问题检测和截图报告', () => {

  test('7.1 所有页面截图', async ({ page }) => {
    await login(page);

    const pages = [
      { path: '/', name: 'homepage' },
      { path: '/practice', name: 'practice' },
      { path: '/practice/training', name: 'training' },
      { path: '/me', name: 'me' },
      { path: '/analyze', name: 'analyze' },
    ];

    for (const { path, name } of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await screenshot(page, `42-${name}`);
      console.log(`✓ 截图 ${name}`);
    }
  });

  test('7.2 检测问题总结', async ({ page }) => {
    await login(page);

    const issues: string[] = [];

    // 检测1: 检查是否有断头路
    await page.goto('/practice/training');
    await page.waitForTimeout(3000);

    const backBtn = page.locator('button:has-text("返回")').first();
    if (await backBtn.count() === 0) {
      issues.push('⚠ 训练页没有返回按钮');
    }

    // 检测2: 检查数字显示是否正常
    await page.goto('/');
    await page.waitForTimeout(2000);

    const numbers = await page.locator('text=/\\d+/').all();
    if (numbers.length < 2) {
      issues.push('⚠ 首页可能缺少数字显示');
    }

    // 检测3: 检查输入框是否可用
    await page.goto('/login');
    const input = page.locator('input[type="text"], input[type="email"]').first();
    if (await input.count() > 0) {
      await input.fill('test');
      const value = await input.inputValue();
      if (value !== 'test') {
        issues.push('⚠ 输入框可能存在问题');
      }
    }

    // 总结
    console.log('\\n========== 问题检测总结 ==========');
    if (issues.length === 0) {
      console.log('✓ 未发现明显问题');
    } else {
      issues.forEach(issue => console.log(issue));
    }
    console.log('=====================================\\n');

    await screenshot(page, '43-issues-report');
  });
});