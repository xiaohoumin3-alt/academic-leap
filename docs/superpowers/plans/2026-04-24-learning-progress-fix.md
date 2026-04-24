# 学习进度与智能推荐修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 修复学习进度手动设置问题，实现基于学期时间的自动进度计算，简化智能推荐逻辑，统一界面展示

**架构:** 添加学期日期字段到User模型，进度根据时间占比自动计算，推荐API简化为直接勾选，界面移除分支模式统一显示知识点树

**技术栈:** Prisma, TypeScript, Next.js, React

---

### Task 1: 数据库迁移 - 添加学期日期字段

**文件:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260424_add_semester_dates/migration.sql`

- [ ] **Step 1: 更新 Prisma Schema**

找到 `model User` 中的 `studyProgress` 字段（约第38行），在其后添加：

```prisma
studyProgress      Int       @default(0) // 学习进度百分比 0-100 (已废弃，保留兼容)
semesterStart      DateTime? // 学期开始日期
semesterEnd        DateTime? // 学期结束日期
```

- [ ] **Step 2: 生成迁移**

```bash
npx prisma migrate dev --name add_semester_dates
```

预期输出：迁移创建成功

- [ ] **Step 3: 验证迁移**

```bash
sqlite3 prisma/dev.db "PRAGMA table_info(User);" | grep semester
```

预期输出：显示 semesterStart 和 semesterEnd 字段

- [ ] **Step 4: 重新生成 Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add semester start/end dates to User model"
```

---

### Task 2: 创建学期工具函数

**文件:**
- Create: `lib/semester.ts`

- [ ] **Step 1: 创建学期工具函数文件**

```typescript
/**
 * 学期相关工具函数
 */

export interface SemesterDates {
  start: Date;
  end: Date;
}

export interface ProgressInfo {
  progress: number;      // 0-100
  message?: string;      // 状态消息
  isValid: boolean;      // 学期是否有效
}

/**
 * 根据当前月份推断默认学期
 */
export function inferDefaultSemester(): SemesterDates {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // 3-7月：春季学期
  if (month >= 3 && month <= 7) {
    return {
      start: new Date(year, 2, 1),     // 3月1日
      end: new Date(year, 6, 15),      // 7月15日
    };
  }
  
  // 9-1月：秋季学期
  if (month >= 9 || month <= 1) {
    const endYear = month <= 1 ? year : year + 1;
    return {
      start: new Date(year, 8, 1),     // 9月1日
      end: new Date(endYear, 0, 20),   // 1月20日
    };
  }

  // 其他月份（2月或8月），默认使用秋季学期
  return {
    start: new Date(year, 8, 1),       // 9月1日
    end: new Date(year + 1, 0, 20),    // 次年1月20日
  };
}

/**
 * 计算学习进度
 */
export function calculateProgress(semesterStart?: Date, semesterEnd?: Date): ProgressInfo {
  const now = new Date();

  // 未设置学期
  if (!semesterStart || !semesterEnd) {
    return {
      progress: 0,
      message: '请设置学期时间',
      isValid: false
    };
  }

  const start = new Date(semesterStart);
  const end = new Date(semesterEnd);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  now.setHours(12, 0, 0, 0);

  // 学期未开始
  if (now < start) {
    return {
      progress: 0,
      message: '学期未开始',
      isValid: true
    };
  }

  // 学期已结束
  if (now > end) {
    return {
      progress: 100,
      message: '学期已结束',
      isValid: true
    };
  }

  // 计算进度
  const totalDuration = end.getTime() - start.getTime();
  const elapsedDuration = now.getTime() - start.getTime();
  const progress = Math.round((elapsedDuration / totalDuration) * 100);

  return {
    progress: Math.max(0, Math.min(100, progress)),
    isValid: true
  };
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析日期输入
 */
export function parseDateInput(input: string): Date | null {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/semester.ts
git commit -m "feat: add semester utility functions for progress calculation"
```

---

### Task 3: 更新 Settings API - 学期设置

**文件:**
- Modify: `app/api/user/settings/route.ts`

- [ ] **Step 1: 更新类型定义**

找到 `interface SettingsUpdateBody`，添加字段：

```typescript
interface SettingsUpdateBody {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;  // 保留兼容性
  semesterStart?: string;  // YYYY-MM-DD 格式
  semesterEnd?: string;    // YYYY-MM-DD 格式
}
```

- [ ] **Step 2: 更新验证函数**

找到 `validateSettingsUpdate` 函数，添加日期验证：

```typescript
function validateSettingsUpdate(body: unknown): body is SettingsUpdateBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { grade, selectedSubject, selectedTextbookId, studyProgress, semesterStart, semesterEnd } = body as Record<string, unknown>;

  // Validate grade if provided
  if (grade !== undefined) {
    if (typeof grade !== 'number' || grade < 1 || grade > 12) {
      return false;
    }
  }

  // Validate selectedSubject if provided
  if (selectedSubject !== undefined) {
    if (typeof selectedSubject !== 'string') {
      return false;
    }
  }

  // Validate selectedTextbookId if provided
  if (selectedTextbookId !== undefined) {
    if (typeof selectedTextbookId !== 'string') {
      return false;
    }
  }

  // Validate studyProgress if provided
  if (studyProgress !== undefined) {
    if (typeof studyProgress !== 'number' || studyProgress < 0 || studyProgress > 100) {
      return false;
    }
  }

  // Validate semester dates if provided
  if (semesterStart !== undefined) {
    if (typeof semesterStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semesterStart)) {
      return false;
    }
  }

  if (semesterEnd !== undefined) {
    if (typeof semesterEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semesterEnd)) {
      return false;
    }
  }

  // 如果同时提供，验证结束日期晚于开始日期
  if (semesterStart && semesterEnd) {
    const start = new Date(semesterStart);
    const end = new Date(semesterEnd);
    if (end <= start) {
      return false;
    }
  }

  return true;
}
```

- [ ] **Step 3: 更新 GET 方法返回数据**

找到 GET 方法的返回数据部分，添加学期字段：

```typescript
return NextResponse.json({
  success: true,
  data: {
    grade: user.grade,
    selectedSubject: user.selectedSubject,
    selectedTextbookId: user.selectedTextbookId,
    selectedTextbook,
    studyProgress: user.studyProgress ?? 0,
    semesterStart: user.semesterStart?.toISOString(),
    semesterEnd: user.semesterEnd?.toISOString(),
  }
});
```

- [ ] **Step 4: 更新 create/select 语句**

找到 select 语句，添加新字段：

```typescript
select: {
  id: true,
  email: true,
  grade: true,
  selectedSubject: true,
  selectedTextbookId: true,
  studyProgress: true,
  semesterStart: true,
  semesterEnd: true,
},
```

有两处 select 语句需要更新（create 和 findUnique）

- [ ] **Step 5: 更新 PUT 方法数据处理**

找到 `prisma.user.update` 的 data 部分，添加日期处理：

```typescript
import { parseDateInput } from '@/lib/semester';

// 在 PUT 方法内部
const { grade, selectedSubject, selectedTextbookId, studyProgress, semesterStart, semesterEnd } = body as SettingsUpdateBody;

// 处理学期日期
let parsedStart: Date | undefined;
let parsedEnd: Date | undefined;

if (semesterStart) {
  parsedStart = parseDateInput(semesterStart);
  if (!parsedStart) {
    return NextResponse.json(
      { success: false, error: '无效的开始日期格式' },
      { status: 400 }
    );
  }
}

if (semesterEnd) {
  parsedEnd = parseDateInput(semesterEnd);
  if (!parsedEnd) {
    return NextResponse.json(
      { success: false, error: '无效的结束日期格式' },
      { status: 400 }
    );
  }
}

// 更新数据
user = await prisma.user.update({
  where: { id: session.user.id },
  data: {
    ...(grade !== undefined && { grade }),
    ...(selectedSubject !== undefined && { selectedSubject }),
    ...(selectedTextbookId !== undefined && { selectedTextbookId }),
    ...(studyProgress !== undefined && { studyProgress }),
    ...(parsedStart && { semesterStart: parsedStart }),
    ...(parsedEnd && { semesterEnd: parsedEnd }),
  },
  select: {
    // ... 同上
  },
});
```

create 部分也需要同样处理

- [ ] **Step 6: Commit**

```bash
git add app/api/user/settings/route.ts
git commit -m "feat: add semester dates to settings API"
```

---

### Task 4: 更新进度 API - 自动计算

**文件:**
- Modify: `app/api/user/progress/route.ts`

- [ ] **Step 1: 重写进度计算逻辑**

完全替换文件内容：

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateProgress } from '@/lib/semester';

// GET /api/user/progress - 获取用户进度计算
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        selectedSubject: true,
        selectedTextbookId: true,
        semesterStart: true,
        semesterEnd: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

    // 计算基于时间的进度
    const progressInfo = calculateProgress(
      user.semesterStart ? new Date(user.semesterStart) : undefined,
      user.semesterEnd ? new Date(user.semesterEnd) : undefined
    );

    // 获取教材的所有章节
    const chapters = await prisma.chapter.findMany({
      where: { textbookId: user.selectedTextbookId },
      orderBy: { chapterNumber: 'asc' },
      select: {
        id: true,
        chapterNumber: true,
        chapterName: true,
      },
    });

    const totalChapters = chapters.length;
    const progress = progressInfo.progress;

    // 根据进度计算当前章节
    const currentChapterIndex = Math.floor((progress / 100) * totalChapters);
    const currentChapter = chapters[Math.min(currentChapterIndex, totalChapters - 1)];
    const completedChapters = Math.min(currentChapterIndex, totalChapters - 1);

    // 统计知识点数量
    const allKnowledgePoints = await prisma.knowledgePoint.count({
      where: {
        chapter: { textbookId: user.selectedTextbookId },
        deletedAt: null,
        inAssess: true,
      },
    });

    const enabledKnowledgeCount = await prisma.userEnabledKnowledge.count({
      where: {
        userId: session.user.id,
        nodeType: 'point',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        currentChapter: currentChapter ? {
          id: currentChapter.id,
          chapterNumber: currentChapter.chapterNumber,
          chapterName: currentChapter.chapterName,
        } : null,
        progress,
        progressMessage: progressInfo.message,
        completedChapters,
        totalChapters,
        enabledKnowledgeCount,
        totalKnowledgeCount: allKnowledgePoints,
      }
    });
  } catch (error: unknown) {
    console.error('获取用户进度错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/user/progress/route.ts
git commit -m "refactor: calculate progress based on semester dates"
```

---

### Task 5: 简化推荐 API

**文件:**
- Modify: `app/api/user/knowledge/recommend/route.ts`

- [ ] **Step 1: 简化推荐逻辑**

完全替换文件内容：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateProgress } from '@/lib/semester';

// POST /api/user/knowledge/recommend - 智能推荐知识点
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        selectedSubject: true,
        selectedTextbookId: true,
        semesterStart: true,
        semesterEnd: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

    // 计算当前进度
    const progressInfo = calculateProgress(
      user.semesterStart ? new Date(user.semesterStart) : undefined,
      user.semesterEnd ? new Date(user.semesterEnd) : undefined
    );
    const progress = progressInfo.progress;

    // 获取教材的所有章节
    const chapters = await prisma.chapter.findMany({
      where: { textbookId: user.selectedTextbookId },
      orderBy: { chapterNumber: 'asc' },
      select: {
        id: true,
        chapterNumber: true,
        chapterName: true,
      },
    });

    const totalChapters = chapters.length;
    if (totalChapters === 0) {
      return NextResponse.json(
        { success: false, error: '教材没有章节' },
        { status: 400 }
      );
    }

    // 根据进度计算推荐到的章节
    const recommendIndex = Math.ceil((progress / 100) * totalChapters);
    const targetChapterIndex = Math.max(0, Math.min(recommendIndex - 1, totalChapters - 1));
    
    // 获取目标章节及之前章节的所有知识点
    const targetChapters = chapters.filter(c => c.chapterNumber <= chapters[targetChapterIndex].chapterNumber);
    const chapterIds = targetChapters.map(c => c.id);

    // 使用事务执行推荐
    await prisma.$transaction(async (tx) => {
      // 清除现有勾选
      await tx.userEnabledKnowledge.deleteMany({
        where: { userId: session.user.id },
      });

      // 获取知识点
      const knowledgePoints = await tx.knowledgePoint.findMany({
        where: {
          chapterId: { in: chapterIds },
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      // 批量插入
      if (knowledgePoints.length > 0) {
        await tx.userEnabledKnowledge.createMany({
          data: knowledgePoints.map(kp => ({
            userId: session.user.id,
            nodeId: kp.id,
            nodeType: 'point' as const,
          })),
        });
      }
    });

    const enabledCount = await prisma.userEnabledKnowledge.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        progress,
        progressMessage: progressInfo.message,
        recommendedChapterName: chapters[targetChapterIndex].chapterName,
        enabledCount,
        totalChapters: targetChapters.length,
        executed: true,
      }
    });
  } catch (error: unknown) {
    console.error('智能推荐错误:', error);
    return NextResponse.json(
      { success: false, error: '推荐失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 更新 API 客户端**

修改 `lib/api.ts`，找到 recommend 方法，简化参数：

```typescript
/**
 * 智能推荐（一键勾选到当前进度）
 */
async recommend() {
  const res = await fetch(`${API_BASE}/user/knowledge/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),  // 空对象
  });
  return res.json() as Promise<ApiResponse<{
    progress: number;
    progressMessage?: string;
    recommendedChapterName: string;
    enabledCount: number;
    totalChapters: number;
    executed: boolean;
  }>>;
},
```

- [ ] **Step 3: Commit**

```bash
git add app/api/user/knowledge/recommend/route.ts lib/api.ts
git commit -m "refactor: simplify recommend API - one-click apply"
```

---

### Task 6: 创建学期设置对话框组件

**文件:**
- Create: `components/SemesterDialog.tsx`

- [ ] **Step 1: 创建学期设置对话框组件**

```typescript
'use client';

import { useState } from 'react';
import MaterialIcon from './MaterialIcon';
import { 
  inferDefaultSemester, 
  calculateProgress, 
  formatDateForInput,
  parseDateInput 
} from '@/lib/semester';

interface SemesterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (start: Date, end: Date) => Promise<void>;
  currentStart?: Date;
  currentEnd?: Date;
}

export default function SemesterDialog({ 
  isOpen, 
  onClose, 
  onSave,
  currentStart,
  currentEnd 
}: SemesterDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // 初始化日期
  useState(() => {
    if (isOpen) {
      const defaultSemester = inferDefaultSemester();
      setStartDate(formatDateForInput(currentStart || defaultSemester.start));
      setEndDate(formatDateForInput(currentEnd || defaultSemester.end));
    }
  });

  const handleSave = async () => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);

    if (!start || !end) {
      alert('请输入有效的日期');
      return;
    }

    if (end <= start) {
      alert('结束日期必须晚于开始日期');
      return;
    }

    setSaving(true);
    try {
      await onSave(start, end);
      onClose();
    } catch (error) {
      console.error('保存学期失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 计算预览进度
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const progressInfo = start && end ? calculateProgress(start, end) : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="calendar_month" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">设置学期</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              学期开始
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border-2 border-transparent focus:border-primary outline-none text-on-surface"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              学期结束
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface border-2 border-transparent focus:border-primary outline-none text-on-surface"
            />
          </div>

          {progressInfo && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-on-surface-variant">当前进度</span>
                <span className="font-bold text-primary">{progressInfo.progress}%</span>
              </div>
              {progressInfo.message && (
                <p className="text-xs text-on-surface-variant">{progressInfo.message}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-surface text-on-surface-variant transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SemesterDialog.tsx
git commit -m "feat: add semester settings dialog component"
```

---

### Task 7: 重构 LearningSettings 组件

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 更新状态管理**

找到组件顶部的状态声明，修改为：

```typescript
const [mode, setMode] = useState<'smart' | 'manual'>('smart');  // 删除此行
const [settings, setSettings] = useState<any>(null);
const [progress, setProgress] = useState(0);
const [progressMessage, setProgressMessage] = useState<string>('');
const [treeData, setTreeData] = useState<any>(null);
const [loading, setLoading] = useState(false);
const [saving, setSaving] = useState(false);

// 教材选择状态
const [showTextbookSelector, setShowTextbookSelector] = useState(false);
const [textbooks, setTextbooks] = useState<Textbook[]>([]);
const [grades, setGrades] = useState<number[]>([]);
const [subjects, setSubjects] = useState<string[]>([]);
const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
const [selectedTextbookId, setSelectedTextbookId] = useState<string | null>(null);

// 编辑模式状态
const [isEditing, setIsEditing] = useState(false);
const [showWarning, setShowWarning] = useState(false);
const [pendingTextbookId, setPendingTextbookId] = useState<string | null>(null);

// 学期设置对话框
const [showSemesterDialog, setShowSemesterDialog] = useState(false);
```

- [ ] **Step 2: 更新 loadSettings 函数**

找到 loadSettings 函数，添加进度信息加载：

```typescript
const loadSettings = async () => {
  setLoading(true);
  try {
    const [settingsRes, progressRes] = await Promise.all([
      fetch('/api/user/settings'),
      fetch('/api/user/progress')
    ]);
    
    const settingsData = await settingsRes.json();
    const progressData = await progressRes.json();

    if (settingsData.data) {
      setSettings(settingsData.data);

      // 如果有教材ID，加载知识树
      if (settingsData.data.selectedTextbookId) {
        const treeRes = await userApi.getKnowledgeTree(false);
        if (treeRes.data) {
          setTreeData(treeRes.data);
        } else {
          setShowTextbookSelector(true);
          await loadTextbooks();
        }
      } else {
        setShowTextbookSelector(true);
        await loadTextbooks();
      }
    }

    if (progressData.data) {
      setProgress(progressData.data.progress);
      setProgressMessage(progressData.data.progressMessage || '');
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    setShowTextbookSelector(true);
    await loadTextbooks();
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: 添加学期保存函数**

在 handleProgressChange 函数之后添加：

```typescript
const handleSaveSemester = async (start: Date, end: Date) => {
  try {
    await userApi.updateSettings({
      semesterStart: start.toISOString().split('T')[0],
      semesterEnd: end.toISOString().split('T')[0],
    });
    await loadSettings();
    onRefresh?.();
  } catch (error) {
    throw error;
  }
};
```

- [ ] **Step 4: 重构主界面 - 移除模式切换**

找到 return 语句中的主界面部分，替换为：

```typescript
return (
  <>
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">学习设置</h3>
        </div>
        {!isEditing && settings?.selectedTextbookId && (
          <button
            onClick={handleEnterEditMode}
            className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
            aria-label="编辑设置"
          >
            <MaterialIcon icon="edit" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        )}
      </div>

      {/* 设置摘要 */}
      <div className="bg-surface rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant">
            {settings?.grade}年级 · {settings?.selectedSubject}
          </span>
          <span className="text-sm text-on-surface-variant">
            {treeData?.enabledCount || 0}/{treeData?.totalCount || 0} 知识点
          </span>
        </div>
        
        {/* 学习进度 */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-on-surface-variant">学习进度</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">{progress}%</span>
                {progressMessage && (
                  <span className="text-xs text-on-surface-variant">({progressMessage})</span>
                )}
              </div>
            </div>
            <div className="w-full bg-surface-container rounded-full h-2">
              <div 
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setShowSemesterDialog(true)}
            className="px-3 py-2 rounded-lg bg-surface hover:bg-surface-container-high text-sm text-on-surface-variant transition-colors"
          >
            设置学期
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleApplyRecommend}
          disabled={saving}
          className="flex-1 py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <MaterialIcon icon="auto_awesome" style={{ fontSize: '18px' }} />
          {saving ? '应用中...' : '应用推荐'}
        </button>
      </div>

      {/* 知识点树 - 始终显示 */}
      {treeData ? (
        <KnowledgeTreeView
          chapters={treeData.chapters}
          onToggle={handleToggle}
          expandable={true}
        />
      ) : (
        <div className="text-center py-8 text-on-surface-variant">
          加载知识点树中...
        </div>
      )}
    </div>

    {/* 学期设置对话框 */}
    <SemesterDialog
      isOpen={showSemesterDialog}
      onClose={() => setShowSemesterDialog(false)}
      onSave={handleSaveSemester}
      currentStart={settings?.semesterStart ? new Date(settings.semesterStart) : undefined}
      currentEnd={settings?.semesterEnd ? new Date(settings.semesterEnd) : undefined}
    />

    {/* 警告对话框 */}
    {showWarning && (
      // ... 保持原有警告对话框代码
    )}
  </>
);
```

- [ ] **Step 5: 删除模式切换相关代码**

删除所有与 `mode` 状态相关的代码，包括：
- `const [mode, setMode] = useState<'smart' | 'manual'>('smart');`
- 模式切换按钮 UI
- 条件渲染 `mode === 'smart'` 的内容

- [ ] **Step 6: 更新 handleApplyRecommend**

找到 handleApplyRecommend 函数，简化为：

```typescript
const handleApplyRecommend = async () => {
  setSaving(true);
  try {
    const res = await userApi.recommend();
    if (res.data?.executed) {
      await loadSettings();
      onRefresh?.();
    }
  } catch (error) {
    console.error('应用推荐失败:', error);
    alert('推荐失败，请重试');
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 7: 添加导入**

在文件顶部添加：

```typescript
import SemesterDialog from './SemesterDialog';
```

- [ ] **Step 8: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "refactor: unify learning settings UI - remove mode branches"
```

---

### Task 8: 更新类型定义

**文件:**
- Modify: `lib/api.ts`

- [ ] **Step 1: 更新 UserSettings 接口**

找到 `export interface UserSettings`，添加字段：

```typescript
export interface UserSettings {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
  semesterStart?: string;  // ISO 8601 格式
  semesterEnd?: string;    // ISO 8601 格式
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api.ts
git commit -m "fix: add semester dates to UserSettings interface"
```

---

### Task 9: 初始化默认学期

**文件:**
- Modify: `app/api/user/settings/route.ts`

- [ ] **Step 1: 添加默认学期初始化逻辑**

在 GET 方法中，找到用户创建逻辑，添加默认学期：

```typescript
import { inferDefaultSemester, formatDateForInput } from '@/lib/semester';

// 在 create 用户时
const defaultSemester = inferDefaultSemester();
user = await prisma.user.create({
  data: {
    id: session.user.id,
    email: session.user.email || '',
    name: session.user.name || null,
    password: '',
    grade: 9,
    targetScore: 90,
    semesterStart: defaultSemester.start,
    semesterEnd: defaultSemester.end,
  },
  select: { /* ... */ },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/user/settings/route.ts
git commit -m "feat: initialize default semester on user creation"
```

---

### Task 10: 测试和验证

**文件:**
- Manual testing

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试学期设置**

1. 登录后进入 /me 页面
2. 点击"设置学期"按钮
3. 修改学期开始/结束日期
4. 确认进度自动更新
5. 保存后刷新页面，确认设置保持

- [ ] **Step 3: 测试智能推荐**

1. 点击"应用推荐"按钮
2. 确认知识点被自动勾选
3. 修改进度，再次点击推荐
4. 确认勾选范围相应变化

- [ ] **Step 4: 测试边界情况**

1. 设置学期开始为未来日期 → 进度显示0%，提示"学期未开始"
2. 设置学期结束为过去日期 → 进度显示100%，提示"学期已结束"
3. 未设置学期 → 进度显示0%，提示"请设置学期时间"

- [ ] **Step 5: TypeScript 编译检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "test: verify learning progress and recommendation fixes"
```

---

## 实施完成检查清单

- [ ] 学期日期字段已添加到数据库
- [ ] 学期工具函数已创建
- [ ] Settings API 支持学期设置
- [ ] 进度 API 自动计算基于时间的进度
- [ ] 推荐 API 简化为一键勾选
- [ ] 学期设置对话框已创建
- [ ] LearningSettings 界面已重构，移除模式分支
- [ ] 默认学期在用户创建时自动初始化
- [ ] 所有 TypeScript 编译通过
- [ ] 手动测试验证功能正常
