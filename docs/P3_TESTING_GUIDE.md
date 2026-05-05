# P3测试指南 - 视觉回归与性能测试

本文档介绍P3优先级任务的视觉回归测试和性能测试配置、运行和报告方式。

---

## 测试类型概述

| 测试类型 | 文件 | 运行命令 | 目的 |
|---------|------|---------|------|
| 视觉回归测试 | `e2e/visual-regression.spec.ts` | `npm run test:visual` | 防止UI意外变化 |
| 性能测试 | `e2e/performance.spec.ts` | `npm run test:performance` | 监控Core Web Vitals |

---

## 视觉回归测试 (Visual Regression Testing)

### 配置

视口配置覆盖三种设备类型：
- **移动端**: 375x667 (iPhone SE尺寸)
- **平板**: 768x1024 (iPad尺寸)
- **桌面**: 1440x900 (标准桌面)

容差配置：
```typescript
maxDiffPixels: 100        // 最大像素差异
threshold: 0.2            // 20%差异阈值
maxDiffRatio: 0.05        // 最大5%像素差异
```

### 运行方式

#### 首次运行（建立基线）
```bash
npm run test:visual:update
```

#### 对比测试（检测UI变化）
```bash
npm run test:visual
```

#### 单个页面测试
```bash
# 只测试首页
npx playwright test e2e/visual-regression.spec.ts -g "首页"

# 只测试登录页
npx playwright test e2e/visual-regression.spec.ts -g "登录页"
```

### 截图存储

截图存储在 `test-results/` 目录下，结构如下：
```
test-results/
├── homepage-mobile-full.png
├── homepage-tablet-full.png
├── homepage-desktop-full.png
├── practice-mobile-full.png
├── login-mobile-form.png
└── ...
```

### 更新基线

当UI变化是有意为之时，更新基线：
```bash
npm run test:visual:update
```

### 多断点测试

响应式断点测试覆盖：
- **xs**: 320px
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

---

## 性能测试 (Performance Testing)

### Core Web Vitals 阈值

| 指标 | 良好 | 需改进 | 不合格 |
|------|------|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | < 4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | < 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 | > 0.25 |
| FCP (First Contentful Paint) | < 1.8s | < 3s | > 3s |
| TTI (Time to Interactive) | < 3.8s | < 7.3s | > 7.3s |

### 运行方式

```bash
npm run test:performance
```

### 性能测试覆盖

1. **Core Web Vitals**
   - LCP: 最大内容绘制时间
   - CLS: 累积布局偏移
   - FCP: 首次内容绘制
   - 页面加载性能

2. **API响应时间**
   - 健康检查: < 200ms
   - 题目获取: < 500ms
   - 用户认证: < 500ms

3. **资源加载**
   - JavaScript Bundle大小检查
   - 图片优化检查（警告 > 1MB）
   - 字体加载检查（最多4个）
   - 第三方脚本检查

4. **运行时性能**
   - 页面交互响应 (INP)
   - 滚动性能（长任务检测）
   - 内存使用（警告 > 100MB）

### 查看性能报告

测试完成后，性能指标会以注释形式显示在测试结果中：
```bash
npm run test:performance
```

在HTML报告中查看详细注释：
```bash
npm run test:report
```

---

## 项目配置

Playwright配置包含以下项目：

| 项目 | 设备 | 用途 |
|------|------|------|
| chromium | Desktop Chrome | 标准E2E测试 |
| visual-regression | Desktop Chrome | 视觉回归测试 |
| performance | Desktop Chrome | 性能测试 |
| mobile-chrome | Pixel 5 | 移动端测试 |
| tablet-ipad | iPad Pro | 平板测试 |

---

## CI/CD集成

### GitHub Actions示例

```yaml
- name: Run visual regression tests
  run: npm run test:visual

- name: Upload screenshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: screenshots
    path: test-results/

- name: Run performance tests
  run: npm run test:performance

- name: Upload performance report
  uses: actions/upload-artifact@v3
  with:
    name: performance-report
    path: test-results/results.json
```

---

## 故障排查

### 视觉回归测试失败

1. 查看差异截图
2. 确认是否为有意UI变化
3. 如果是有意变化，运行 `npm run test:visual:update`

### 性能测试失败

1. 查看具体哪个指标未达标
2. 使用浏览器DevTools分析
3. 检查资源大小和加载时间
4. 优化Bundle或资源加载

### 截图不稳定

如果截图因动态内容而不稳定：
1. 增加 `waitForTimeout` 时间
2. 使用 `clip` 截图特定区域
3. Mock动态数据
4. 使用 `animation-states` 截图

---

## 最佳实践

1. **定期运行**: 在每次PR前运行视觉回归测试
2. **性能基准**: 建立性能基准线，追踪变化趋势
3. **自动化**: 在CI中集成这些测试
4. **快速反馈**: 使用 `--headed` 模式调试失败测试

---

## 扩展测试

### 添加新的视觉回归测试

```typescript
test('新页面 - 完整页面截图', async ({ page }) => {
  await page.goto('/new-page');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  await expect(page).toHaveScreenshot(`new-page-full.png`, {
    fullPage: true,
    maxDiffPixels: 100,
    threshold: 0.2,
    maxDiffRatio: 0.05
  });
});
```

### 添加新的性能测试

```typescript
test('新API - 响应时间', async ({ request }) => {
  const startTime = Date.now();
  const response = await request.get('/api/new-endpoint');
  const responseTime = Date.now() - startTime;

  expect(responseTime).toBeLessThan(500); // 500ms阈值

  test.info().annotations.push({
    type: 'API',
    description: `New API: ${responseTime}ms`
  });
});
```

---

## 文件路径

- 视觉回归测试: `/Users/seanxx/academic-leap/academic-leap/e2e/visual-regression.spec.ts`
- 性能测试: `/Users/seanxx/academic-leap/academic-leap/e2e/performance.spec.ts`
- Playwright配置: `/Users/seanxx/academic-leap/academic-leap/playwright.config.ts`
