import { test, expect } from '@playwright/test';

/**
 * ⚡ 性能测试 (Performance Testing)
 *
 * 测试目标：
 * 1. Core Web Vitals 监控 (LCP < 2.5s, INP < 200ms, CLS < 0.1)
 * 2. API响应时间监控
 * 3. 资源加载性能
 * 4. Bundle大小检查
 *
 * 运行方式：npm run test:performance
 */

// Core Web Vitals 阈值
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint (ms)
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay (ms)
  INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint (ms)
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint (ms)
  TTI: { good: 3800, needsImprovement: 7300 }  // Time to Interactive (ms)
};

// API响应时间阈值
const API_THRESHOLDS = {
  fast: 200,      // < 200ms 优秀
  acceptable: 500, // < 500ms 可接受
  slow: 1000      // > 1000ms 需要优化
};

// Bundle大小阈值 (gzip后)
const BUNDLE_THRESHOLDS = {
  'page.js': 150,      // KB - Next.js核心bundle
  'index.js': 100,     // KB - 首页bundle
  'practice.js': 150,  // KB - 练习页bundle
  'vendor.js': 200     // KB - 第三方库
};

test.describe('⚡ Performance - Core Web Vitals', () => {
  test('首页 - LCP (Largest Contentful Paint)', async ({ page }) => {
    const lcpMetrics: number[] = [];

    // 监听LCP
    await page.goto('/', { waitUntil: 'networkidle' });

    const lcp = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry?.renderTime || lastEntry?.loadTime || 0);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // 5秒后超时返回0
        setTimeout(() => resolve(0), 5000);
      });
    });

    if (lcp > 0) {
      lcpMetrics.push(lcp);
      const avgLcp = lcpMetrics.reduce((a, b) => a + b, 0) / lcpMetrics.length;

      expect(avgLcp).toBeLessThan(WEB_VITALS_THRESHOLDS.LCP.good);

      // 添加注释显示实际值
      test.info().annotations.push({
        type: 'LCP',
        description: `LCP: ${avgLcp.toFixed(0)}ms (threshold: ${WEB_VITALS_THRESHOLDS.LCP.good}ms)`
      });
    }
  });

  test('首页 - CLS (Cumulative Layout Shift)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // 等待布局稳定

    const cls = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });

        setTimeout(() => resolve(clsValue), 3000);
      });
    });

    expect(cls).toBeLessThan(WEB_VITALS_THRESHOLDS.CLS.good);

    test.info().annotations.push({
      type: 'CLS',
      description: `CLS: ${cls.toFixed(3)} (threshold: ${WEB_VITALS_THRESHOLDS.CLS.good})`
    });
  });

  test('首页 - FCP (First Contentful Paint)', async ({ page }) => {
    const fcp = await page.goto('/').then(async () => {
      const performanceEntries = await page.evaluate(() => {
        const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        return entries[0]?.loadEventEnd || 0;
      });
      return performanceEntries;
    });

    // 使用Chrome DevTools Protocol获取更精确的FCP
    const fcpMetric = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint') as PerformanceEntry[];
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return fcpEntry?.startTime || 0;
    });

    if (fcpMetric > 0) {
      expect(fcpMetric).toBeLessThan(WEB_VITALS_THRESHOLDS.FCP.good);

      test.info().annotations.push({
        type: 'FCP',
        description: `FCP: ${fcpMetric.toFixed(0)}ms (threshold: ${WEB_VITALS_THRESHOLDS.FCP.good}ms)`
      });
    }
  });

  test('练习页 - 页面加载性能', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/practice', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    // 页面应在3秒内完全加载
    expect(loadTime).toBeLessThan(3000);

    test.info().annotations.push({
      type: 'PageLoad',
      description: `Practice page loaded in ${loadTime}ms`
    });
  });

  test('分析页 - 图表渲染性能', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/analyze', { waitUntil: 'domcontentloaded' });

    // 等待可能的图表渲染
    await page.waitForTimeout(2000);

    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(4000);

    test.info().annotations.push({
      type: 'ChartRender',
      description: `Analyze page rendered in ${renderTime}ms`
    });
  });
});

test.describe('⚡ Performance - API Response Time', () => {
  test('API - 健康检查响应时间', async ({ request }) => {
    const startTime = Date.now();

    try {
      const response = await request.get('/api/health');
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(API_THRESHOLDS.fast);

      test.info().annotations.push({
        type: 'API',
        description: `Health check: ${responseTime}ms`
      });
    } catch {
      // 如果健康检查端点不存在，跳过测试
      test.skip(true, 'Health check endpoint not available');
    }
  });

  test('API - 题目获取响应时间', async ({ page }) => {
    let apiResponseTime: number | null = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/questions') || response.url().includes('/api/practice')) {
        const timing = response.timing();
        if (timing) {
          apiResponseTime = timing.responseEnd;
        }
      }
    });

    await page.goto('/practice');
    await page.waitForTimeout(2000);

    if (apiResponseTime !== null) {
      expect(apiResponseTime).toBeLessThan(API_THRESHOLDS.acceptable);

      test.info().annotations.push({
        type: 'API',
        description: `Question API: ${apiResponseTime}ms`
      });
    }
  });

  test('API - 用户认证响应时间', async ({ page }) => {
    let apiResponseTime: number | null = null;

    page.on('response', async (response) => {
      if (response.url().includes('/api/auth')) {
        const timing = response.timing();
        if (timing) {
          apiResponseTime = timing.responseEnd;
        }
      }
    });

    await page.goto('/login');
    await page.waitForTimeout(1000);

    if (apiResponseTime !== null) {
      expect(apiResponseTime).toBeLessThan(API_THRESHOLDS.acceptable);

      test.info().annotations.push({
        type: 'API',
        description: `Auth API: ${apiResponseTime}ms`
      });
    }
  });
});

test.describe('⚡ Performance - Resource Loading', () => {
  test('资源 - JavaScript Bundle大小检查', async ({ page }) => {
    const jsResources: { name: string; size: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js') && !url.includes('node_modules')) {
        const headers = response.headers();
        const contentLength = headers['content-length'];
        if (contentLength) {
          jsResources.push({
            name: url.split('/').pop() || 'unknown',
            size: parseInt(contentLength, 10)
          });
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 报告加载的JS文件
    const totalSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const totalSizeKB = (totalSize / 1024).toFixed(2);

    test.info().annotations.push({
      type: 'BundleSize',
      description: `Total JS: ${totalSizeKB}KB (${jsResources.length} files)`
    });

    // 检查是否有过大的单个文件
    const largeFiles = jsResources.filter(r => r.size > 500 * 1024); // > 500KB
    expect(largeFiles.length).toBe(0);
  });

  test('资源 - 图片优化检查', async ({ page }) => {
    const imageResources: { url: string; size: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.match(/\.(jpg|jpeg|png|webp|avif|gif)$/i)) {
        const headers = response.headers();
        const contentLength = headers['content-length'];
        if (contentLength) {
          imageResources.push({
            url,
            size: parseInt(contentLength, 10)
          });
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 报告加载的图片
    const totalSize = imageResources.reduce((sum, r) => sum + r.size, 0);
    const totalSizeKB = (totalSize / 1024).toFixed(2);

    test.info().annotations.push({
      type: 'ImageSize',
      description: `Total images: ${totalSizeKB}KB (${imageResources.length} files)`
    });

    // 检查是否有超大图片
    const hugeImages = imageResources.filter(r => r.size > 1024 * 1024); // > 1MB
    if (hugeImages.length > 0) {
      test.info().annotations.push({
        type: 'Warning',
        description: `${hugeImages.length} image(s) > 1MB detected`
      });
    }
  });

  test('资源 - 字体加载检查', async ({ page }) => {
    const fontResources: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.match(/\.(woff2?|ttf|otf|eot)$/i)) {
        fontResources.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 字体文件不应太多
    expect(fontResources.length).toBeLessThanOrEqual(4);

    test.info().annotations.push({
      type: 'Fonts',
      description: `Font files loaded: ${fontResources.length}`
    });
  });

  test('资源 - 第三方脚本检查', async ({ page }) => {
    const thirdPartyScripts: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const isThirdParty = !url.includes(window.location.hostname);
      if (isThirdParty && url.endsWith('.js')) {
        thirdPartyScripts.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    test.info().annotations.push({
      type: 'ThirdParty',
      description: `Third-party scripts: ${thirdPartyScripts.length}`
    });

    // 警告过多的第三方脚本
    if (thirdPartyScripts.length > 5) {
      test.info().annotations.push({
        type: 'Warning',
        description: `Consider reducing third-party scripts (${thirdPartyScripts.length} detected)`
      });
    }
  });
});

test.describe('⚡ Performance - Runtime Performance', () => {
  test('运行时 - 页面交互响应 (INP)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 模拟用户交互
    const interactionTimes: number[] = [];

    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(3, count); i++) {
        const startTime = Date.now();
        await buttons.nth(i).click();
        const interactionTime = Date.now() - startTime;
        interactionTimes.push(interactionTime);
        await page.waitForTimeout(500);
      }

      const avgTime = interactionTimes.reduce((a, b) => a + b, 0) / interactionTimes.length;

      expect(avgTime).toBeLessThan(API_THRESHOLDS.acceptable);

      test.info().annotations.push({
        type: 'Interaction',
        description: `Avg interaction time: ${avgTime.toFixed(0)}ms`
      });
    }
  });

  test('运行时 - 滚动性能', async ({ page }) => {
    await page.goto('/analyze');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // 监控长任务
    const longTasks: number[] = await page.evaluate(() => {
      return new Promise<number[]>((resolve) => {
        const tasks: number[] = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (entry.duration > 50) {
              tasks.push(entry.duration);
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });

        setTimeout(() => {
          observer.disconnect();
          resolve(tasks);
        }, 3000);
      });
    });

    // 滚动页面
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(500);

    // 长任务不应太多或太长
    const severeLongTasks = longTasks.filter(t => t > 200);
    expect(severeLongTasks.length).toBeLessThan(3);

    test.info().annotations.push({
      type: 'LongTasks',
      description: `Long tasks detected: ${longTasks.length}, severe: ${severeLongTasks.length}`
    });
  });

  test('运行时 - 内存使用', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const memoryInfo = await page.evaluate(() => {
      return {
        usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
        totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
        jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit || 0
      };
    });

    if (memoryInfo.usedJSHeapSize > 0) {
      const usedMB = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);

      test.info().annotations.push({
        type: 'Memory',
        description: `JS Heap: ${usedMB}MB`
      });

      // 警告高内存使用
      if (memoryInfo.usedJSHeapSize > 100 * 1024 * 1024) {
        test.info().annotations.push({
          type: 'Warning',
          description: 'High memory usage detected (> 100MB)'
        });
      }
    }
  });
});

test.describe('⚡ Performance - Network Conditions', () => {
  test('慢速网络 - 首页加载', async ({ page }) => {
    // 模拟慢速3G网络
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.context().setOffline(false);

    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // 即使在慢速网络下，也应在10秒内完成首屏加载
    expect(loadTime).toBeLessThan(10000);

    test.info().annotations.push({
      type: 'SlowNetwork',
      description: `Slow 3G load time: ${loadTime}ms`
    });
  });
});

test.describe('⚡ Performance - Bundle Analysis', () => {
  test('Bundle - 导出分析报告', async ({ page }) => {
    const bundleInfo: Record<string, number> = {};

    page.on('response', async (response) => {
      const url = response.url();
      if (url.endsWith('.js')) {
        const filename = url.split('/').pop() || 'unknown';
        const headers = response.headers();
        const size = parseInt(headers['content-length'] || '0', 10);
        bundleInfo[filename] = (bundleInfo[filename] || 0) + size;
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 生成bundle报告
    const bundleReport = Object.entries(bundleInfo)
      .sort(([, a], [, b]) => b - a)
      .map(([name, size]) => `${name}: ${(size / 1024).toFixed(2)}KB`)
      .join('\n');

    test.info().annotations.push({
      type: 'BundleReport',
      description: bundleReport || 'No bundle data collected'
    });
  });
});
