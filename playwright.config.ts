import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    storageState: process.env.STORAGE_STATE || 'e2e/storage-state.json',
    actionTimeout: 60000,
    navigationTimeout: 60000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        // 视觉回归测试配置
        screenshot: 'only-on-failure',
        video: 'off',
      },
      testMatch: /.*\.visual-regression\.spec\.ts/,
    },
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // 性能测试配置
        screenshot: 'off',
        video: 'off',
        trace: 'off',
      },
      testMatch: /.*\.performance\.spec\.ts/,
    },
    // 移动端测试项目
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /.*(visual-regression|smoke)\.spec\.ts/,
    },
    // 平板测试项目
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Pro'] },
      testMatch: /.*(visual-regression|smoke)\.spec\.ts/,
    },
  ],
  webServer: process.env.CI || process.env.BASE_URL?.includes('vercel') ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
