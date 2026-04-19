import { test } from '@playwright/test';

test('调试: 直接访问页面组件', async ({ page }) => {
  // 直接等待React应用加载
  await page.goto('/');
  await page.waitForTimeout(2000);
  
  // 尝试通过编程方式触发导航（模拟）
  await page.evaluate(() => {
    // 找到所有导航按钮
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('分析')) {
        console.log('找到分析按钮，点击...');
        (btn as HTMLButtonElement).click();
        break;
      }
    }
  });
  
  await page.waitForTimeout(2000);
  
  const hasTitle = await page.locator('text=学情解构').count();
  console.log('学情解构数量:', hasTitle);
  
  // 尝试另一种方式：直接修改React状态（需要访问React DevTools）
  await page.screenshot({ path: 'test-screenshot.png' });
});
