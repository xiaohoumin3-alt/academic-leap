import { test as base, Page, FullConfig } from '@playwright/test';

// Admin credentials - use environment variables in production
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Extend base Playwright test with admin authenticated page
export const test = base.extend<{
  adminConsole: Page;
}>({
  adminConsole: async ({ page, baseURL }, use) => {
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

    // Login using API directly to get the token cookie
    try {
      const loginResponse = await page.request.post(`${baseURL}/api/admin/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        headers: { 'Content-Type': 'application/json' }
      });
      const loginData = await loginResponse.json();
      if (loginData.success) {
        needsLogin = false;
      }
    } catch (error) {
      // Login failed, will try page-based login
    }

    // Navigate to console
    try {
      await page.goto('/console', { waitUntil: 'networkidle', timeout: 15000 });
    } catch {
      // If redirect loop detected, just continue
    }

    // Check if authenticated - if not, try page-based login
    const currentUrl = page.url();
    if (currentUrl.includes('/console/login') || needsLogin) {
      try {
        await page.goto('/console/login', { waitUntil: 'networkidle', timeout: 15000 });
      } catch {
        // Ignore
      }

      // Fill login form
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      if (await emailInput.count() > 0) {
        await emailInput.fill(ADMIN_EMAIL);
        await passwordInput.fill(ADMIN_PASSWORD);
        await submitButton.click();

        try {
          await page.waitForURL(/\/console/, { timeout: 10000 });
        } catch {
          // Ignore
        }
      }
    }

    // Wait for page to stabilize
    try {
      await page.waitForLoadState('networkidle');
    } catch {
      await page.waitForLoadState('domcontentloaded');
    }

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
      // Ignore storage state errors
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
