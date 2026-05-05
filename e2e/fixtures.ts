import { test as base, Page, FullConfig } from '@playwright/test';

// Admin credentials - use environment variables in production
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Extend base Playwright test with admin authenticated page
export const test = base.extend<{
  adminConsole: Page;
}>({
  adminConsole: async ({ page }, use) => {
    const authPath = 'e2e/.auth/admin-console.json';
    let needsLogin = true;

    // Try to load existing auth state
    try {
      const fs = require('fs');
      if (fs.existsSync(authPath)) {
        const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        // Check if storage state has valid cookies
        if (storageState.cookies && storageState.cookies.length > 0) {
          await page.context().addCookies(storageState.cookies);
          needsLogin = false;
        }
      }
    } catch (error) {
      // No valid auth state, will login
    }

    // Navigate to console and check auth status
    try {
      await page.goto('/console', { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {
      // Console page might not exist, go to login
      await page.goto('/console/login', { waitUntil: 'domcontentloaded' });
    }

    // Check if we need to login
    const hasLoginButton = await page.getByText('登录控制台').count() > 0;
    const isOnLoginPage = page.url().includes('/login');

    if (needsLogin || hasLoginButton || isOnLoginPage) {
      // Navigate to login if needed
      if (!page.url().includes('/login')) {
        await page.goto('/console/login', { waitUntil: 'domcontentloaded' });
      }

      // Fill and submit login form with multiple selector strategies
      const emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
      const passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));

      await emailInput.fill(ADMIN_EMAIL);
      await passwordInput.fill(ADMIN_PASSWORD);

      await page.click('button[type="submit"]');

      // Wait for navigation to console
      try {
        await page.waitForURL(/\/console/, { timeout: 10000 });
      } catch {
        // Login might not redirect, check if we're on a valid page
        await page.waitForLoadState('domcontentloaded');
      }

      // Wait for page to stabilize
      await page.waitForTimeout(2000);

      // Save storage state for future runs
      try {
        const fs = require('fs');
        const path = require('path');
        const authDir = path.dirname(authPath);
        if (!fs.existsSync(authDir)) {
          fs.mkdirSync(authDir, { recursive: true });
        }
        await page.context().storageState({ path: authPath });
      } catch (error) {
        console.log('Could not save auth state:', error.message);
      }
    }

    // Ensure page is ready
    await page.waitForLoadState('domcontentloaded');

    await use(page);
  },
});

export { expect } from '@playwright/test';
