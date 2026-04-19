import { test } from '@playwright/test';

test('调试: 点击分析按钮', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // 截图首页
  await page.screenshot({ path: 'debug-1-home.png' });
  
  // 点击分析
  await page.click('text=分析');
  await page.waitForTimeout(2000);
  
  // 截图点击后
  await page.screenshot({ path: 'debug-2-after-click.png' });
  
  // 检查URL和内容
  console.log('URL:', page.url());
  const hasTitle = await page.locator('text=学情解构').count();
  console.log('学情解构数量:', hasTitle);
});
