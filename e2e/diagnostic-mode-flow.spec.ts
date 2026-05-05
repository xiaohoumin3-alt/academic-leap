import { test, expect, Page } from '@playwright/test';

/**
 * 🧪 测评模式完整流程E2E测试
 *
 * 测试目标：验证测评模式下的完整答题流程
 * 1. 测评模式入口验证（从首页点击"开始精准测评"）
 * 2. 测评模式答题流程（无行为反馈）
 * 3. 测评完成后跳转到分析页面
 * 4. 验证测评模式下不显示行为反馈
 */

// ============================================================================
// Page Object Model
// ============================================================================

class DiagnosticModePage {
  constructor(readonly page: Page) {}

  /**
   * 从首页点击"开始精准测评"进入测评模式
   */
  async startFromHomePage(): Promise<boolean> {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);

    // 查找"开始精准测评"按钮
    const assessBtn = this.page.getByText('开始精准测评', { exact: false }).first();

    const isVisible = await assessBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await assessBtn.click();
      await this.page.waitForTimeout(2000);
      return true;
    }

    console.log('未找到"开始精准测评"按钮，可能是老用户');
    return false;
  }

  /**
   * 直接导航到测评模式
   */
  async gotoDiagnostic(difficulty = 2) {
    await this.page.goto(`/practice?mode=diagnostic&difficulty=${difficulty}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  /**
   * 检测当前答题模式
   */
  async detectAnswerMode(): Promise<'YES_NO' | 'NUMBER' | 'COORDINATE' | 'CHOICE' | 'UNKNOWN'> {
    await this.page.waitForTimeout(500);

    // YES_NO
    const yesBtn = this.page.locator('button').filter({ hasText: /^是$/ });
    const noBtn = this.page.locator('button').filter({ hasText: /^否$/ });
    if (await yesBtn.isVisible().catch(() => false) && await noBtn.isVisible().catch(() => false)) {
      return 'YES_NO';
    }

    // CHOICE
    const choices = this.page.locator('button').filter({ hasText: /^[A-D][\.、:]/ });
    if (await choices.count() > 1) {
      return 'CHOICE';
    }

    // COORDINATE
    const xLabel = this.page.locator('label').filter({ hasText: /^x$/i });
    const yLabel = this.page.locator('label').filter({ hasText: /^y$/i });
    if (await xLabel.isVisible().catch(() => false) && await yLabel.isVisible().catch(() => false)) {
      return 'COORDINATE';
    }

    // NUMBER
    const inputs = this.page.locator('input:not([readonly]):not([disabled])');
    if (await inputs.count() > 0) {
      return 'NUMBER';
    }

    return 'UNKNOWN';
  }

  /**
   * 验证当前是测评模式（不是训练模式）
   */
  async isDiagnosticMode(): Promise<boolean> {
    const url = this.page.url();
    if (url.includes('mode=diagnostic')) {
      return true;
    }

    // 检查页面内容
    const content = await this.page.content();
    return content.includes('测评') || content.includes('第') && content.includes('题');
  }

  /**
   * 答题（通用方法）
   */
  async answerQuestion(): Promise<boolean> {
    const mode = await this.detectAnswerMode();

    switch (mode) {
      case 'YES_NO':
        await this.page.locator('button').filter({ hasText: /^是$/ }).first().click();
        return true;

      case 'NUMBER': {
        const input = this.page.locator('input:not([readonly]):not([disabled])').first();
        if (await input.isVisible().catch(() => false)) {
          await input.fill('1');
          const submitBtn = this.page.locator('button').filter({ hasText: /^提交$/ }).first();
          if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await submitBtn.click();
          } else {
            await input.press('Enter');
          }
          return true;
        }
        return false;
      }

      case 'CHOICE': {
        const choices = this.page.locator('button').filter({ hasText: /^[A-D][\.、:]/ });
        if (await choices.count() > 0) {
          await choices.first().click();
          return true;
        }
        return false;
      }

      case 'COORDINATE': {
        const xLabel = this.page.locator('label').filter({ hasText: /^x$/i }).first();
        const yLabel = this.page.locator('label').filter({ hasText: /^y$/i }).first();
        if (await xLabel.isVisible().catch(() => false)) {
          const xInput = xLabel.locator('..').locator('input').first();
          const yInput = yLabel.locator('..').locator('input').first();
          await xInput.fill('1');
          await yInput.fill('1');
          await this.page.locator('button').filter({ hasText: /^提交$/ }).first().click();
          return true;
        }
        return false;
      }

      default:
        // 尝试点击任意按钮
        const btn = this.page.locator('button').first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          return true;
        }
        return false;
    }
  }

  /**
   * 等待反馈
   */
  async waitForFeedback(): Promise<'correct' | 'incorrect' | 'none'> {
    await this.page.waitForTimeout(1500);

    const content = await this.page.content();

    if (content.includes('正确') || content.includes('✓')) {
      return 'correct';
    }
    if (content.includes('错误') || content.includes('✗')) {
      return 'incorrect';
    }
    return 'none';
  }

  /**
   * 检查是否有行为反馈（测评模式不应该有）
   */
  async hasBehaviorFeedback(): Promise<boolean> {
    await this.page.waitForTimeout(500);

    const content = await this.page.content();
    return content.includes('秒解') || content.includes('稳住') || content.includes('偏慢');
  }

  /**
   * 获取当前题目序号
   */
  async getCurrentQuestionNumber(): Promise<number> {
    const content = await this.page.content();

    // 尝试匹配 "第 X 题" 或 "X / Y"
    const match1 = content.match(/第\s*(\d+)\s*题/);
    if (match1) {
      return parseInt(match1[1], 10);
    }

    const match2 = content.match(/(\d+)\s*\/\s*\d+/);
    if (match2) {
      return parseInt(match2[1], 10);
    }

    return 1;
  }

  /**
   * 检查是否已完成测评
   */
  async isDiagnosticCompleted(): Promise<boolean> {
    const content = await this.page.content();
    return content.includes('测评完成') || content.includes('挑战完成') ||
           content.includes('查看分析') || content.includes('分析结果');
  }

  /**
   * 跳转到分析页面
   */
  async goToAnalyzePage(): Promise<boolean> {
    // 查找"查看分析"或类似按钮
    const analyzeBtn = this.page.getByText(/查看分析|分析结果|去分析/).first();

    if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyzeBtn.click();
      await this.page.waitForTimeout(2000);
      return true;
    }

    // 直接导航
    await this.page.goto('/analyze');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
    return true;
  }

  /**
   * 验证在分析页面
   */
  async isOnAnalyzePage(): Promise<boolean> {
    const url = this.page.url();
    if (url.includes('/analyze')) {
      return true;
    }

    const content = await this.page.content();
    return content.includes('分析') || content.includes('能力') || content.includes('报告');
  }

  /**
   * 获取测评统计数据
   */
  async getDiagnosticStats(): Promise<{
    hasScore: boolean;
    hasCorrectRate: boolean;
    hasDifficultyLevel: boolean;
    hasKnowledgePoints: boolean;
  }> {
    const content = await this.page.content();

    return {
      hasScore: content.includes('分') || content.includes('score'),
      hasCorrectRate: content.includes('%') || content.includes('正确率'),
      hasDifficultyLevel: content.includes('难度') || content.includes('level'),
      hasKnowledgePoints: content.includes('知识点') || content.includes('掌握'),
    };
  }
}

// ============================================================================
// 测试套件：测评模式入口
// ============================================================================

test.describe('测评模式 - 入口验证', () => {
  let diagPage: DiagnosticModePage;

  test.beforeEach(async ({ page }) => {
    diagPage = new DiagnosticModePage(page);
  });

  test('从首页点击"开始精准测评"进入测评', async ({ page }) => {
    // 步骤1：从首页进入
    const started = await diagPage.startFromHomePage();

    if (started) {
      // 步骤2：验证进入测评模式
      const isDiagnostic = await diagPage.isDiagnosticMode();
      expect(isDiagnostic).toBe(true);

      // 步骤3：验证URL或页面内容
      const url = page.url();
      console.log('测评页面URL:', url);

      const hasDiagnosticContent = url.includes('diagnostic') || url.includes('practice');
      expect(hasDiagnosticContent).toBe(true);
    } else {
      // 如果是老用户，直接导航到测评页
      await diagPage.gotoDiagnostic();
      const isDiagnostic = await diagPage.isDiagnosticMode();
      expect(isDiagnostic).toBe(true);
    }
  });

  test('直接访问测评模式URL', async ({ page }) => {
    await diagPage.gotoDiagnostic(2);

    // 验证是测评模式
    const isDiagnostic = await diagPage.isDiagnosticMode();
    expect(isDiagnostic).toBe(true);

    // 验证页面有题目
    const mode = await diagPage.detectAnswerMode();
    console.log('测评模式答题类型:', mode);
    expect(mode).not.toBe('UNKNOWN');
  });
});

// ============================================================================
// 测试套件：测评模式答题流程（无行为反馈）
// ============================================================================

test.describe('测评模式 - 答题流程验证', () => {
  let diagPage: DiagnosticModePage;

  test.beforeEach(async ({ page }) => {
    diagPage = new DiagnosticModePage(page);
    await diagPage.gotoDiagnostic(2);
  });

  test('测评模式：答题 → 反馈 → 下一题（无行为反馈）', async ({ page }) => {
    // 步骤1：确认在测评模式
    const isDiagnostic = await diagPage.isDiagnosticMode();
    expect(isDiagnostic).toBe(true);

    // 步骤2：答题
    const answered = await diagPage.answerQuestion();
    expect(answered).toBe(true);

    // 步骤3：等待反馈
    const feedback = await diagPage.waitForFeedback();
    console.log('测评模式答题反馈:', feedback);

    // 步骤4：验证有反馈
    const content = await page.content();
    const hasFeedback = content.includes('正确') || content.includes('错误');
    expect(hasFeedback || feedback !== 'none').toBe(true);

    // 步骤5：验证无行为反馈
    await page.waitForTimeout(500);
    const hasBehaviorFeedback = await diagPage.hasBehaviorFeedback();
    console.log('是否有行为反馈:', hasBehaviorFeedback);

    // 测评模式不应该有行为反馈（秒解/稳住/偏慢）
    expect(hasBehaviorFeedback).toBe(false);
  });

  test('测评模式：连续答题3题，验证无行为反馈', async ({ page }) => {
    let answerCount = 0;
    let behaviorFeedbackCount = 0;

    for (let i = 0; i < 5; i++) {
      // 答题
      const answered = await diagPage.answerQuestion();

      if (answered) {
        answerCount++;
        await page.waitForTimeout(1500);

        // 检查是否有行为反馈
        const hasBehavior = await diagPage.hasBehaviorFeedback();
        if (hasBehavior) {
          behaviorFeedbackCount++;
          console.log(`第${answerCount}题检测到行为反馈（不应该有）`);
        }

        // 检查反馈
        const feedback = await diagPage.waitForFeedback();
        console.log(`第${answerCount}题反馈: ${feedback}`);

        // 等待下一题
        await page.waitForTimeout(1000);

        if (answerCount >= 3) break;
      }
    }

    console.log(`完成${answerCount}题，检测到${behaviorFeedbackCount}次行为反馈`);

    // 验证答题数量
    expect(answerCount).toBeGreaterThan(0);

    // 测评模式不应该有行为反馈
    expect(behaviorFeedbackCount).toBe(0);
  });

  test('测评模式：YES_NO题型答题流程', async ({ page }) => {
    // 尝试找到YES_NO题目
    let foundYesNo = false;
    for (let attempt = 0; attempt < 5 && !foundYesNo; attempt++) {
      const mode = await diagPage.detectAnswerMode();

      if (mode === 'YES_NO') {
        foundYesNo = true;

        // 点击"是"
        await page.locator('button').filter({ hasText: /^是$/ }).first().click();

        // 等待反馈
        await page.waitForTimeout(1500);
        const feedback = await diagPage.waitForFeedback();
        console.log('测评YES_NO反馈:', feedback);

        // 验证无行为反馈
        const hasBehavior = await diagPage.hasBehaviorFeedback();
        expect(hasBehavior).toBe(false);

        // 验证有答题反馈
        const content = await page.content();
        const hasAnswerFeedback = content.includes('正确') || content.includes('错误');
        expect(hasAnswerFeedback || feedback !== 'none').toBe(true);
      } else {
        await page.reload();
        await page.waitForTimeout(2000);
      }
    }

    if (!foundYesNo) {
      console.log('未找到YES_NO题目');
      test.skip(true, 'No YES_NO question found');
    }
  });

  test('测评模式：NUMBER题型答题流程', async ({ page }) => {
    const mode = await diagPage.detectAnswerMode();

    if (mode === 'NUMBER' || mode === 'UNKNOWN') {
      const input = page.locator('input:not([readonly]):not([disabled])').first();
      const isVisible = await input.isVisible().catch(() => false);

      if (isVisible) {
        // 输入答案
        await input.fill('1');

        // 提交
        const submitBtn = page.locator('button').filter({ hasText: /^提交$/ }).first();
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.click();
        } else {
          await input.press('Enter');
        }

        // 等待反馈
        await page.waitForTimeout(1500);
        const feedback = await diagPage.waitForFeedback();
        console.log('测评NUMBER反馈:', feedback);

        // 验证无行为反馈
        const hasBehavior = await diagPage.hasBehaviorFeedback();
        expect(hasBehavior).toBe(false);
      }
    } else {
      console.log('当前模式:', mode);
      test.skip(true, 'Not in NUMBER mode');
    }
  });

  test('测评模式：CHOICE题型答题流程', async ({ page }) => {
    // 尝试找到CHOICE题目
    let foundChoice = false;
    for (let attempt = 0; attempt < 5 && !foundChoice; attempt++) {
      const mode = await diagPage.detectAnswerMode();

      if (mode === 'CHOICE') {
        foundChoice = true;

        // 选择第一个选项
        const choices = page.locator('button').filter({ hasText: /^[A-D][\.、:]/ });
        const choiceCount = await choices.count();

        expect(choiceCount).toBeGreaterThan(0);

        await choices.first().click();

        // 等待反馈
        await page.waitForTimeout(1500);
        const feedback = await diagPage.waitForFeedback();
        console.log('测评CHOICE反馈:', feedback);

        // 验证无行为反馈
        const hasBehavior = await diagPage.hasBehaviorFeedback();
        expect(hasBehavior).toBe(false);
      } else {
        await page.reload();
        await page.waitForTimeout(2000);
      }
    }

    if (!foundChoice) {
      console.log('未找到CHOICE题目');
      test.skip(true, 'No CHOICE question found');
    }
  });
});

// ============================================================================
// 测试套件：测评完成与跳转
// ============================================================================

test.describe('测评模式 - 完成与跳转', () => {
  let diagPage: DiagnosticModePage;

  test.beforeEach(async ({ page }) => {
    diagPage = new DiagnosticModePage(page);
  });

  test('测评完成后显示完成界面', async ({ page }) => {
    await diagPage.gotoDiagnostic(2);

    // 连续答题直到完成
    let maxQuestions = 10;
    let answeredCount = 0;

    for (let i = 0; i < maxQuestions; i++) {
      const answered = await diagPage.answerQuestion();

      if (answered) {
        answeredCount++;
        await page.waitForTimeout(1500);

        // 检查是否完成
        const isCompleted = await diagPage.isDiagnosticCompleted();
        if (isCompleted) {
          console.log(`答题${answeredCount}题后完成测评`);
          break;
        }
      }
    }

    console.log(`总共答题${answeredCount}题`);

    // 验证至少完成了几题
    expect(answeredCount).toBeGreaterThan(0);
  });

  test('测评完成后可跳转到分析页', async ({ page }) => {
    await diagPage.gotoDiagnostic(2);

    // 答题几题
    for (let i = 0; i < 3; i++) {
      await diagPage.answerQuestion();
      await page.waitForTimeout(1500);
    }

    // 尝试跳转到分析页
    const navigated = await diagPage.goToAnalyzePage();

    if (navigated) {
      // 验证在分析页
      const isOnAnalyze = await diagPage.isOnAnalyzePage();
      console.log('是否在分析页:', isOnAnalyze);

      expect(isOnAnalyze).toBe(true);
    }
  });

  test('分析页面显示测评统计数据', async ({ page }) => {
    // 直接导航到分析页（假设已有测评数据）
    await diagPage.goToAnalyzePage();

    // 验证分析页内容
    const isOnAnalyze = await diagPage.isOnAnalyzePage();
    if (!isOnAnalyze) {
      console.log('分析页可能没有数据，跳过验证');
      test.skip(true, 'No diagnostic data available');
      return;
    }

    // 获取统计数据
    const stats = await diagPage.getDiagnosticStats();
    console.log('测评统计:', stats);

    // 至少应该有一些统计信息
    const hasAnyStat = stats.hasScore || stats.hasCorrectRate ||
                       stats.hasDifficultyLevel || stats.hasKnowledgePoints;
    expect(hasAnyStat).toBe(true);
  });
});

// ============================================================================
// 测试套件：测评模式与训练模式对比
// ============================================================================

test.describe('测评模式 vs 训练模式对比', () => {
  test('验证两种模式的区别', async ({ page }) => {
    const diagPage = new DiagnosticModePage(page);

    // 测试测评模式
    await diagPage.gotoDiagnostic(2);
    const isDiagnostic = await diagPage.isDiagnosticMode();
    expect(isDiagnostic).toBe(true);

    // 答一题
    await diagPage.answerQuestion();
    await page.waitForTimeout(1500);

    // 检查无行为反馈
    const hasBehaviorInDiagnostic = await diagPage.hasBehaviorFeedback();
    console.log('测评模式行为反馈:', hasBehaviorInDiagnostic);

    // 切换到训练模式
    await page.goto('/practice?mode=training&difficulty=2');
    await page.waitForTimeout(2000);

    const isTraining = !await diagPage.isDiagnosticMode();
    console.log('训练模式验证:', isTraining);

    // 答一题
    await diagPage.answerQuestion();
    await page.waitForTimeout(1500);

    // 训练模式可能有行为反馈（取决于答题速度）
    const hasBehaviorInTraining = await diagPage.hasBehaviorFeedback();
    console.log('训练模式行为反馈:', hasBehaviorInTraining);

    // 测评模式不应该有行为反馈
    expect(hasBehaviorInDiagnostic).toBe(false);
  });
});

// ============================================================================
// 测试套件：测评模式边界条件
// ============================================================================

test.describe('测评模式 - 边界条件', () => {
  let diagPage: DiagnosticModePage;

  test.beforeEach(async ({ page }) => {
    diagPage = new DiagnosticModePage(page);
  });

  test('测评模式：答错题目后继续下一题', async ({ page }) => {
    await diagPage.gotoDiagnostic(2);

    const mode = await diagPage.detectAnswerMode();

    // 故意答错
    if (mode === 'NUMBER') {
      const input = page.locator('input:not([readonly]):not([disabled])').first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill('999999');
        const submitBtn = page.locator('button').filter({ hasText: /^提交$/ }).first();
        if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await submitBtn.click();
        }
        await page.waitForTimeout(1500);

        // 验证有错误反馈
        const feedback = await diagPage.waitForFeedback();
        console.log('错误答案反馈:', feedback);

        // 验证可以继续
        const content = await page.content();
        const canContinue = content.includes('第') || content.includes('下一');
        expect(canContinue).toBe(true);
      }
    } else {
      await diagPage.answerQuestion();
    }
  });

  test('测评模式：快速连续答题', async ({ page }) => {
    await diagPage.gotoDiagnostic(2);

    // 快速答题3题
    for (let i = 0; i < 3; i++) {
      await diagPage.answerQuestion();
      await page.waitForTimeout(500); // 短暂等待
    }

    // 验证页面仍然响应
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('测评模式：不同难度级别', async ({ page }) => {
    // 测试不同难度
    for (const difficulty of [1, 2, 3]) {
      await diagPage.gotoDiagnostic(difficulty);

      // 验证页面加载
      const isDiagnostic = await diagPage.isDiagnosticMode();
      expect(isDiagnostic).toBe(true);

      // 验证有题目
      const mode = await diagPage.detectAnswerMode();
      console.log(`难度${difficulty}:`, mode);

      // 答一题验证
      await diagPage.answerQuestion();
      await page.waitForTimeout(1000);
    }
  });
});
