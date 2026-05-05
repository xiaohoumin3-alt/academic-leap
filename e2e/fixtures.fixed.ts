import { test as base, Page } from '@playwright/test';

// Admin credentials - should use environment variables in production
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const test = base.extend<{
  adminConsole: Page;
}>({
  adminConsole: async ({ browser }, use) => {
    // Create a new context with proper storage state
    const context = await browser.newContext();

    // Try to load existing auth state
    const authPath = 'e2e/.auth/admin-console.json';
    let needsLogin = true;

    try {
      const fs = require('fs');
      if (fs.existsSync(authPath)) {
        const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        // Check if storage state has valid cookies
        if (storageState.cookies && storageState.cookies.length > 0) {
          await context.addCookies(storageState.cookies);
          needsLogin = false;
        }
      }
    } catch (error) {
      console.log('No valid auth state found, will login');
    }

    const page = await context.newPage();

    if (needsLogin) {
      // Perform login
      await page.goto('/console/login', { waitUntil: 'networkidle' });

      // Fill login form with proper selectors
      await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for navigation to console
      await page.waitForURL(/\/console/, { timeout: 10000 });

      // Save storage state for future runs
      const fs = require('fs');
      const path = require('path');
      const authDir = path.dirname(authPath);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
      await context.storageState({ path: authPath });
    } else {
      // Verify existing auth is still valid
      await page.goto('/console', { waitUntil: 'networkidle' });

      // Check if we're redirected to login (auth expired)
      if (page.url().includes('/login')) {
        // Re-login needed
        await page.goto('/console/login');
        await page.fill('input[type="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/console/, { timeout: 10000 });
        await context.storageState({ path: authPath });
      }
    }

    // Ensure we're on console page
    await page.waitForLoadState('domcontentloaded');

    await use(page);

    // Cleanup
    await context.close();
  },
});

export { expect } from '@playwright/test';
