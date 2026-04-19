/**
 * 认证状态生成脚本
 *
 * 用法: npx tsx e2e/utils/auth-setup.ts
 *
 * 此脚本会:
 * 1. 打开浏览器访问登录页面
 * 2. 使用测试账户登录
 * 3. 保存登录状态到 storage-state.json
 * 4. 所有后续测试将使用此保存的登录状态
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function saveAuthState() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'test123456';

  console.log(`🔐 正在生成认证状态...`);
  console.log(`   URL: ${baseURL}`);
  console.log(`   Email: ${email}`);

  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  page.setDefaultTimeout(60000);

  // 监听所有网络请求
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api/auth')) {
      console.log(`📤 API Request: ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('api/auth') || status >= 400) {
      console.log(`📥 API Response: ${status} ${url}`);
      if (status >= 400) {
        response.text().then(text => console.log(`   Body: ${text.substring(0, 200)}`)).catch(() => {});
      }
    }
  });

  try {
    console.log(`📄 正在打开登录页面...`);
    await page.goto(`${baseURL}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log(`📄 登录页面已加载`);

    const emailInput = page.getByPlaceholder('请输入邮箱');
    const passwordInput = page.getByPlaceholder('请输入密码');

    await emailInput.fill(email);
    await passwordInput.fill(password);
    console.log(`🔑 已输入登录信息`);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log(`🔑 已提交登录表单`);

    console.log(`⏳ 等待响应...`);
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`📍 当前 URL: ${currentUrl}`);

    // 检查错误消息
    const errorSelectors = [
      'text=/邮箱或密码错误/',
      'text=/操作失败/',
      'text=/错误/',
      '.text-error',
      '[role="alert"]'
    ];

    for (const selector of errorSelectors) {
      const errorElement = page.locator(selector).first();
      if (await errorElement.count() > 0) {
        const errorText = await errorElement.textContent();
        if (errorText?.trim()) {
          console.log(`❌ 错误消息: ${errorText}`);
        }
      }
    }

    if (currentUrl === baseURL || currentUrl === baseURL + '/') {
      console.log(`✅ 登录成功！`);

      const storagePath = 'e2e/storage-state.json';
      const storageDir = dirname(storagePath);

      if (!existsSync(storageDir)) {
        mkdirSync(storageDir, { recursive: true });
      }

      await context.storageState({ path: storagePath });
      console.log(`💾 登录状态已保存到: ${storagePath}`);
    } else {
      throw new Error(`登录失败，未跳转到首页。当前 URL: ${currentUrl}`);
    }
  } catch (error) {
    console.error(`❌ 登录失败:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

saveAuthState().catch(console.error);
