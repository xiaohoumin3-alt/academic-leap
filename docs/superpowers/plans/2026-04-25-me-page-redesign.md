# 我的页面重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构我的页面，移除学习统计，合并用户信息和学习设置为弹窗模式

**Architecture:** 简化 MePage 组件，将 LearningSettings 改为弹窗模式，移除重复的统计卡片

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `app/me/page.tsx` | 修改 | 移除 stats 状态和统计卡片，合并用户信息设置 |
| `components/LearningSettings.tsx` | 修改 | 改为弹窗模式，添加 isOpen/onClose/onSave props |

---

## Task 1: 重构 MePage 组件

**Files:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: 移除 stats 相关状态和类型定义**

在 `app/me/page.tsx` 中删除：

```typescript
// 删除这些接口和状态
interface UserStats { ... }
const [stats, setStats] = useState<UserStats | null>(null);
```

删除 analytics API 调用和 stats 转换逻辑。

- [ ] **Step 2: 移除学习统计卡片**

删除整个"学习统计"卡片（约第 185-211 行）：

```typescript
{/* 删除这个区块 */}
{/* 学习统计 */}
<div className="bg-surface-container-low rounded-[2rem] p-6 mb-6">
  ...
</div>
```

- [ ] **Step 3: 添加设置弹窗状态**

在组件中添加：

```typescript
const [showSettings, setShowSettings] = useState(false);
```

- [ ] **Step 4: 重构用户信息卡片**

将用户信息卡片改为：

```typescript
{/* 用户信息卡片 - 合并设置显示 */}
<div className="bg-surface-container-low rounded-[2rem] p-6 mb-6">
  <div className="flex items-center gap-4 mb-4">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
      <MaterialIcon icon="person" className="text-primary" style={{ fontSize: '32px' }} />
    </div>
    <div className="flex-1">
      <h2 className="text-xl font-display font-bold text-on-surface">
        {user.name || '学习者'}
      </h2>
      <p className="text-sm text-on-surface-variant">{user.email}</p>
    </div>
  </div>

  {/* 学习设置信息 */}
  {settings && (
    <div className="flex items-center justify-between py-3 border-t border-surface-variant/20">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
        <span>{settings.grade}年级·{settings.selectedSubject || '未设置'}</span>
        {settings.selectedTextbookId && <span>·已选教材</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-on-surface-variant">目标 {settings.targetScore || 90}分</span>
        <button
          onClick={() => setShowSettings(true)}
          className="text-sm text-primary font-medium hover:underline"
        >
          修改
        </button>
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 5: 移除独立的 LearningSettings 组件**

删除底部的 LearningSettings 组件调用：

```typescript
{/* 删除这个区块 */}
{/* 学习设置 */}
<div className="mt-6">
  <LearningSettings onRefresh={...} />
</div>
```

- [ ] **Step 6: 添加设置弹窗**

在周报弹窗后面添加：

```typescript
{/* 学习设置弹窗 */}
<LearningSettingsDialog
  isOpen={showSettings}
  onClose={() => setShowSettings(false)}
  onSave={async () => {
    // 刷新设置数据
    const settingsRes = await fetch('/api/user/settings');
    const settingsData = await settingsRes.json();
    if (settingsData.data) {
      setSettings(settingsData.data);
    }
    setShowSettings(false);
  }}
/>
```

- [ ] **Step 7: 验证改动**

Run: `pnpm tsc --noEmit`
Expected: No errors

---

## Task 2: 创建 LearningSettingsDialog 组件

**Files:**
- Create: `components/LearningSettingsDialog.tsx`

- [ ] **Step 1: 创建组件文件**

```typescript
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';

interface LearningSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface UserSettings {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  targetScore?: number;
}

const GRADES = [7, 8, 9];
const SUBJECTS = ['数学', '物理', '化学', '英语'];
const TARGET_SCORES = [80, 85, 90, 95, 100];

export default function LearningSettingsDialog({
  isOpen,
  onClose,
  onSave,
}: LearningSettingsDialogProps) {
  const [settings, setSettings] = useState<UserSettings>({});
  const [textbooks, setTextbooks] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/user/settings');
      const data = await res.json();
      if (data.data) {
        setSettings(data.data);
        // 加载教材列表
        if (data.data.selectedSubject) {
          loadTextbooks();
        }
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  const loadTextbooks = async () => {
    try {
      const res = await fetch('/api/admin/textbooks');
      const data = await res.json();
      if (data.data) {
        setTextbooks(data.data);
      }
    } catch (error) {
      console.error('加载教材失败:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        onSave();
      }
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-on-surface">学习设置</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center"
          >
            <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 年级选择 */}
          <div>
            <label className="text-sm text-on-surface-variant mb-2 block">年级</label>
            <div className="flex gap-2">
              {GRADES.map(grade => (
                <button
                  key={grade}
                  onClick={() => setSettings({ ...settings, grade })}
                  className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                    settings.grade === grade
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* 科目选择 */}
          <div>
            <label className="text-sm text-on-surface-variant mb-2 block">科目</label>
            <div className="flex gap-2">
              {SUBJECTS.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSettings({ ...settings, selectedSubject: subject })}
                  className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                    settings.selectedSubject === subject
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          {/* 目标分数 */}
          <div>
            <label className="text-sm text-on-surface-variant mb-2 block">目标分数</label>
            <div className="flex gap-2">
              {TARGET_SCORES.map(score => (
                <button
                  key={score}
                  onClick={() => setSettings({ ...settings, targetScore: score })}
                  className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                    settings.targetScore === score
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 MePage 中导入新组件**

在 `app/me/page.tsx` 顶部添加：

```typescript
import LearningSettingsDialog from '@/components/LearningSettingsDialog';
```

- [ ] **Step 3: 验证类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

---

## Task 3: 清理未使用的代码

**Files:**
- Modify: `components/LearningSettings.tsx` (标记为废弃，保留一段时间后删除)

- [ ] **Step 1: 添加废弃注释**

在 `components/LearningSettings.tsx` 顶部添加：

```typescript
/**
 * @deprecated 使用 LearningSettingsDialog 代替
 * 此组件将被移除，请使用弹窗模式的设置对话框
 */
```

- [ ] **Step 2: 更新 MePage 导入**

确保 `app/me/page.tsx` 不再导入 `LearningSettings`：

删除：
```typescript
import LearningSettings from '@/components/LearningSettings';
```

---

## Task 4: 验证改动

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/seanxx/academic-leap/academic-leap && pnpm dev`

- [ ] **Step 2: 手动测试页面**

1. 访问 `/me` 页面
2. 确认学习统计卡片已移除
3. 确认用户信息卡片显示年级、科目、目标分数
4. 点击"修改"按钮，确认设置弹窗打开
5. 修改设置并保存，确认更新正确
6. 确认学习路径概览正常显示

- [ ] **Step 3: 检查控制台错误**

打开浏览器控制台，确认没有错误或警告

---

## 验收清单

- [ ] 学习统计卡片已移除
- [ ] 用户信息卡片合并了设置显示
- [ ] 点击"修改"按钮打开设置弹窗
- [ ] 设置保存后正确更新显示
- [ ] 学习路径概览正常工作
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误
