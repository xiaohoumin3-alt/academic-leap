# 复杂度功能导航集成方案

> 日期: 2026-04-28
> 状态: 已批准

## 目标

将已实现的复杂度功能集成到控制台导航，让学生端和管理后台都能方便访问。

## 解决方案

### 控制台数据管理页签

在 `/console` 的"数据管理"页签中增加"题目特征"子页签：

```
数据管理 | 题目特征
```

#### 内容布局

| 区块 | 组件 | 用途 |
|------|------|------|
| 统计概览 | `ComplexityStats` | 显示总数/已提取/覆盖率 |
| 分布图 | `ComplexityDistribution` | 可视化复杂度分布 |
| 操作区 | `ExtractionActions` | 开始提取/重置按钮 |
| 快捷入口 | 内联链接 | 权重监控/低置信度审核 |

#### 页面结构

```tsx
// app/console/page.tsx
type SubTab = 'knowledge' | 'complexity';

<SubTabSwitcher
  options={[
    { value: 'knowledge', label: '数据管理' },
    { value: 'complexity', label: '题目特征' },
  ]}
/>

{activeSubTab === 'complexity' && <ComplexityAdminPanel />}
```

### 复用组件

| 现有组件 | 用途 | 路径 |
|----------|------|------|
| `ComplexityStats` | 统计概览 | `app/admin/complexity/complexity-stats.tsx` |
| `ComplexityDistribution` | 分布图 | `app/admin/complexity/complexity-distribution.tsx` |
| `ExtractionActions` | 操作按钮 | `app/admin/complexity/extraction-actions.tsx` |

### API 端点

- `GET /api/admin/complexity/status` - 获取提取状态统计

## 实施步骤

1. 在 `ConsolePage` 组件中添加 `SubTab` 类型
2. 创建 `ComplexityAdminPanel` 组件整合现有组件
3. 在 data 页签内添加子页签切换
4. 测试导航和数据加载

## 学生端

学生端暂不修改，复杂度分析入口保持现有位置 (`/analyze?tab=complexity`)。