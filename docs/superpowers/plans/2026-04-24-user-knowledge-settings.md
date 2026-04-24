# 用户端知识点设置系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户端添加年级/科目/教材选择和知识点勾选功能，使练习和测评能够基于用户的知识点范围进行。

**Architecture:** 用户选择设置 → User 表存储 → UserEnabledKnowledge 存储勾选 → API 返回知识点树 → 练习/测评使用

**Tech Stack:** Next.js 15 App Router, Prisma, TypeScript, React Motion

---

## Task 1: 用户设置 API (GET/PUT /api/user/settings)

**Files:**
- Create: `app/api/user/settings/route.ts`
- Test: `e2e/user-settings.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/user-settings.spec.ts
import { test, expect } from '@playwright/test';

test.describe('用户设置 API', () => {
  test('GET /api/user/settings 返回用户设置', async ({ request }) => {
    const response = await request.get('/api/user/settings');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('selectedGrade');
    expect(data.data).toHaveProperty('selectedSubject');
    expect(data.data).toHaveProperty('selectedTextbookId');
    expect(data.data).toHaveProperty('studyProgress');
  });

  test('PUT /api/user/settings 更新用户设置', async ({ request }) => {
    const response = await request.put('/api/user/settings', {
      data: {
        selectedGrade: 8,
        selectedSubject: '数学',
        selectedTextbookId: 'test-textbook-id',
        studyProgress: 50
      }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.selectedGrade).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- e2e/user-settings.spec.ts
```
Expected: FAIL with route not found

- [ ] **Step 3: Create API route file**

```typescript
// app/api/user/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/settings - 获取用户设置
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
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 获取教材详情
    let selectedTextbook = null;
    if (user.selectedTextbookId) {
      const textbook = await prisma.textbookVersion.findUnique({
        where: { id: user.selectedTextbookId },
        select: { id: true, name: true, year: true }
      });
      selectedTextbook = textbook;
    }

    return NextResponse.json({
      success: true,
      data: {
        selectedGrade: user.selectedGrade,
        selectedSubject: user.selectedSubject,
        selectedTextbookId: user.selectedTextbookId,
        selectedTextbook,
        studyProgress: user.studyProgress ?? 0,
      }
    });
  } catch (error: any) {
    console.error('获取用户设置错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

// PUT /api/user/settings - 更新用户设置
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { selectedGrade, selectedSubject, selectedTextbookId, studyProgress } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(selectedGrade !== undefined && { selectedGrade }),
        ...(selectedSubject !== undefined && { selectedSubject }),
        ...(selectedTextbookId !== undefined && { selectedTextbookId }),
        ...(studyProgress !== undefined && { studyProgress }),
      },
      select: {
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        selectedGrade: user.selectedGrade,
        selectedSubject: user.selectedSubject,
        selectedTextbookId: user.selectedTextbookId,
        studyProgress: user.studyProgress ?? 0,
      }
    });
  } catch (error: any) {
    console.error('更新用户设置错误:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- e2e/user-settings.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/user/settings/route.ts e2e/user-settings.spec.ts
git commit -m "feat: add user settings API (GET/PUT /api/user/settings)"
```

---

## Task 2: 进度计算 API (GET /api/user/progress)

**Files:**
- Create: `app/api/user/progress/route.ts`
- Test: `e2e/user-progress.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/user-progress.spec.ts
import { test, expect } from '@playwright/test';

test.describe('用户进度 API', () => {
  test('GET /api/user/progress 返回进度计算', async ({ request }) => {
    const response = await request.get('/api/user/progress');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('currentChapter');
    expect(data.data).toHaveProperty('progress');
    expect(data.data).toHaveProperty('completedChapters');
    expect(data.data).toHaveProperty('totalChapters');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- e2e/user-progress.spec.ts
```
Expected: FAIL with route not found

- [ ] **Step 3: Create API route file**

```typescript
// app/api/user/progress/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

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
    const progress = user.studyProgress ?? 0;

    // 根据进度计算当前章节
    const currentChapterIndex = Math.floor((progress / 100) * totalChapters);
    const currentChapter = chapters[Math.min(currentChapterIndex, totalChapters - 1)];
    const completedChapters = Math.min(currentChapterIndex, totalChapters);

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
        completedChapters,
        totalChapters,
        enabledKnowledgeCount,
        totalKnowledgeCount: allKnowledgePoints,
      }
    });
  } catch (error: any) {
    console.error('获取用户进度错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- e2e/user-progress.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/user/progress/route.ts e2e/user-progress.spec.ts
git commit -m "feat: add user progress API (GET /api/user/progress)"
```

---

## Task 3: 知识点树 API (GET /api/user/knowledge-tree)

**Files:**
- Create: `app/api/user/knowledge-tree/route.ts`
- Test: `e2e/knowledge-tree.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/knowledge-tree.spec.ts
import { test, expect } from '@playwright/test';

test.describe('知识点树 API', () => {
  test('GET /api/user/knowledge-tree 返回知识点树', async ({ request }) => {
    const response = await request.get('/api/user/knowledge-tree');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('textbook');
    expect(data.data).toHaveProperty('chapters');
    expect(Array.isArray(data.data.chapters)).toBe(true);
  });

  test('知识点树包含勾选状态', async ({ request }) => {
    const response = await request.get('/api/user/knowledge-tree');
    const data = await response.json();
    const chapter = data.data.chapters[0];
    expect(chapter).toHaveProperty('enabled');
    if (chapter.knowledgePoints.length > 0) {
      expect(chapter.knowledgePoints[0]).toHaveProperty('enabled');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- e2e/knowledge-tree.spec.ts
```
Expected: FAIL with route not found

- [ ] **Step 3: Create API route file**

```typescript
// app/api/user/knowledge-tree/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/knowledge-tree - 获取知识点树
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const expand = searchParams.get('expand') === 'true';

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

    // 获取教材信息
    const textbook = await prisma.textbookVersion.findUnique({
      where: { id: user.selectedTextbookId },
      select: {
        id: true,
        name: true,
        grade: true,
        subject: true,
      },
    });

    if (!textbook) {
      return NextResponse.json(
        { success: false, error: '教材不存在' },
        { status: 404 }
      );
    }

    // 获取用户已勾选的知识点
    const enabledKnowledge = await prisma.userEnabledKnowledge.findMany({
      where: {
        userId: session.user.id,
        nodeType: 'point',
      },
      select: { nodeId: true },
    });
    const enabledIds = new Set(enabledKnowledge.map(k => k.nodeId));

    // 获取章节
    let chapters = await prisma.chapter.findMany({
      where: { textbookId: user.selectedTextbookId },
      orderBy: { chapterNumber: 'asc' },
      include: {
        knowledgePoints: {
          where: { deletedAt: null, inAssess: true },
          include: {
            concept: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // 如果不展开，按进度裁剪
    if (!expand && user.studyProgress !== undefined && user.studyProgress < 100) {
      const totalChapters = chapters.length;
      const maxChapterIndex = Math.ceil((user.studyProgress / 100) * totalChapters);
      chapters = chapters.slice(0, maxChapterIndex + 1);
    }

    // 构建响应数据
    const chaptersData = chapters.map(chapter => {
      const chapterEnabled = chapter.knowledgePoints.every(kp => enabledIds.has(kp.id));
      return {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterName: chapter.chapterName,
        enabled: chapterEnabled,
        knowledgePoints: chapter.knowledgePoints.map(kp => ({
          id: kp.id,
          name: kp.name,
          conceptId: kp.concept.id,
          conceptName: kp.concept.name,
          enabled: enabledIds.has(kp.id),
        })),
      };
    });

    const allKnowledgePoints = await prisma.knowledgePoint.count({
      where: {
        chapter: { textbookId: user.selectedTextbookId },
        deletedAt: null,
        inAssess: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        textbook,
        chapters: chaptersData,
        enabledCount: enabledIds.size,
        totalCount: allKnowledgePoints,
      }
    });
  } catch (error: any) {
    console.error('获取知识点树错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- e2e/knowledge-tree.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/user/knowledge-tree/route.ts e2e/knowledge-tree.spec.ts
git commit -m "feat: add knowledge tree API (GET /api/user/knowledge-tree)"
```

---

## Task 4: 知识点勾选 API (POST /api/user/knowledge/toggle)

**Files:**
- Create: `app/api/user/knowledge/toggle/route.ts`
- Test: `e2e/knowledge-toggle.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/knowledge-toggle.spec.ts
import { test, expect } from '@playwright/test';

test.describe('知识点勾选 API', () => {
  test('POST /api/user/knowledge/toggle 勾选知识点', async ({ request }) => {
    const response = await request.post('/api/user/knowledge/toggle', {
      data: {
        nodeId: 'test-point-id',
        nodeType: 'point',
        enabled: true
      }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('affectedCount');
  });

  test('支持章节级联勾选', async ({ request }) => {
    const response = await request.post('/api/user/knowledge/toggle', {
      data: {
        nodeId: 'test-chapter-id',
        nodeType: 'chapter',
        enabled: true,
        cascade: true
      }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.data.affectedCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- e2e/knowledge-toggle.spec.ts
```
Expected: FAIL with route not found

- [ ] **Step 3: Create API route file**

```typescript
// app/api/user/knowledge/toggle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/user/knowledge/toggle - 勾选/取消知识点或章节
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { nodeId, nodeType, enabled, cascade = false } = body;

    if (!nodeId || !nodeType || enabled === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    let affectedCount = 0;

    if (nodeType === 'chapter' && cascade) {
      // 章节级联：获取章节下所有知识点
      const knowledgePoints = await prisma.knowledgePoint.findMany({
        where: {
          chapterId: nodeId,
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      // 批量操作知识点
      for (const kp of knowledgePoints) {
        if (enabled) {
          await prisma.userEnabledKnowledge.upsert({
            where: {
              unique_user_nodeId: {
                userId: session.user.id,
                nodeId: kp.id,
              },
            },
            create: {
              userId: session.user.id,
              nodeId: kp.id,
              nodeType: 'point',
            },
            update: {},
          });
        } else {
          await prisma.userEnabledKnowledge.deleteMany({
            where: {
              userId: session.user.id,
              nodeId: kp.id,
            },
          });
        }
      }
      affectedCount = knowledgePoints.length;
    } else {
      // 单节点操作
      if (enabled) {
        await prisma.userEnabledKnowledge.upsert({
          where: {
            unique_user_nodeId: {
              userId: session.user.id,
              nodeId,
            },
          },
          create: {
            userId: session.user.id,
            nodeId,
            nodeType,
          },
          update: {},
        });
      } else {
        await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId: session.user.id,
            nodeId,
          },
        });
      }
      affectedCount = 1;
    }

    return NextResponse.json({
      success: true,
      data: { affectedCount }
    });
  } catch (error: any) {
    console.error('知识点勾选错误:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- e2e/knowledge-toggle.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/user/knowledge/toggle/route.ts e2e/knowledge-toggle.spec.ts
git commit -m "feat: add knowledge toggle API (POST /api/user/knowledge/toggle)"
```

---

## Task 5: 智能推荐 API (POST /api/user/knowledge/recommend)

**Files:**
- Create: `app/api/user/knowledge/recommend/route.ts`
- Test: `e2e/knowledge-recommend.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/knowledge-recommend.spec.ts
import { test, expect } from '@playwright/test';

test.describe('智能推荐 API', () => {
  test('POST /api/user/knowledge/recommend 基于进度推荐', async ({ request }) => {
    const response = await request.post('/api/user/knowledge/recommend', {
      data: { overwrite: false }
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('recommendedChapterId');
    expect(data.data).toHaveProperty('enabledCount');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- e2e/knowledge-recommend.spec.ts
```
Expected: FAIL with route not found

- [ ] **Step 3: Create API route file**

```typescript
// app/api/user/knowledge/recommend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    const body = await req.json();
    const { overwrite = false } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

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
    const progress = user.studyProgress ?? 0;

    // 根据进度计算推荐到的章节
    const recommendIndex = Math.ceil((progress / 100) * totalChapters);
    const recommendedChapter = chapters[Math.min(recommendIndex, totalChapters) - 1];

    if (!recommendedChapter) {
      return NextResponse.json(
        { success: false, error: '无可用章节' },
        { status: 404 }
      );
    }

    // 如果不覆盖，先检查是否已有勾选
    if (!overwrite) {
      const existingCount = await prisma.userEnabledKnowledge.count({
        where: { userId: session.user.id },
      });
      if (existingCount > 0) {
        // 返回推荐但不执行
        return NextResponse.json({
          success: true,
          data: {
            recommendedChapterId: recommendedChapter.id,
            recommendedChapterName: recommendedChapter.chapterName,
            progress,
            enabledCount: existingCount,
            executed: false,
          }
        });
      }
    }

    // 清除现有勾选（如果覆盖）
    if (overwrite) {
      await prisma.userEnabledKnowledge.deleteMany({
        where: { userId: session.user.id },
      });
    }

    // 获取推荐章节及之前章节的所有知识点
    const targetChapters = chapters.filter(c => c.chapterNumber <= recommendedChapter.chapterNumber);
    const chapterIds = targetChapters.map(c => c.id);

    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        chapterId: { in: chapterIds },
        deletedAt: null,
        inAssess: true,
      },
      select: { id: true },
    });

    // 批量插入
    await prisma.userEnabledKnowledge.createMany({
      data: knowledgePoints.map(kp => ({
        userId: session.user.id,
        nodeId: kp.id,
        nodeType: 'point',
      })),
      skipDuplicates: true,
    });

    const enabledCount = await prisma.userEnabledKnowledge.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendedChapterId: recommendedChapter.id,
        recommendedChapterName: recommendedChapter.chapterName,
        progress,
        enabledCount,
        executed: true,
      }
    });
  } catch (error: any) {
    console.error('智能推荐错误:', error);
    return NextResponse.json(
      { success: false, error: '推荐失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- e2e/knowledge-recommend.spec.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/user/knowledge/recommend/route.ts e2e/knowledge-recommend.spec.ts
git commit -m "feat: add smart recommendation API (POST /api/user/knowledge/recommend)"
```

---

## Task 6: 更新 lib/api.ts 添加用户设置相关 API

**Files:**
- Modify: `lib/api.ts`

- [ ] **Step 1: Add new API methods to lib/api.ts**

```typescript
// 在 lib/api.ts 中 userApi 对象中添加

interface UserSettings {
  selectedGrade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
}

interface KnowledgeTreeNode {
  id: string;
  chapterNumber?: number;
  chapterName?: string;
  name?: string;
  type?: 'chapter' | 'point';
  enabled: boolean;
  conceptId?: string;
  conceptName?: string;
  knowledgePoints?: KnowledgeTreeNode[];
}

interface KnowledgeTreeResponse {
  textbook: {
    id: string;
    name: string;
    grade: number;
    subject: string;
  };
  chapters: KnowledgeTreeNode[];
  enabledCount: number;
  totalCount: number;
}

// 扩展 userApi
export const userApi = {
  // ... 现有方法

  /**
   * 获取用户学习设置
   */
  async getSettings() {
    const res = await fetch(`${API_BASE}/user/settings`);
    return res.json() as Promise<ApiResponse<UserSettings & { selectedTextbook?: { id: string; name: string; year: string } }>>;
  },

  /**
   * 更新用户学习设置
   */
  async updateSettings(data: UserSettings) {
    const res = await fetch(`${API_BASE}/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<UserSettings>>;
  },

  /**
   * 获取知识点树
   */
  async getKnowledgeTree(expand = false) {
    const res = await fetch(`${API_BASE}/user/knowledge-tree?expand=${expand}`);
    return res.json() as Promise<ApiResponse<KnowledgeTreeResponse>>;
  },

  /**
   * 勾选/取消知识点
   */
  async toggleKnowledge(data: { nodeId: string; nodeType: 'chapter' | 'point'; enabled: boolean; cascade?: boolean }) {
    const res = await fetch(`${API_BASE}/user/knowledge/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ affectedCount: number }>>;
  },

  /**
   * 智能推荐
   */
  async recommend(overwrite = false) {
    const res = await fetch(`${API_BASE}/user/knowledge/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overwrite }),
    });
    return res.json() as Promise<ApiResponse<{
      recommendedChapterId: string;
      recommendedChapterName: string;
      progress: number;
      enabledCount: number;
      executed: boolean;
    }>>;
  },

  /**
   * 获取进度计算
   */
  async getProgress() {
    const res = await fetch(`${API_BASE}/user/progress`);
    return res.json() as Promise<ApiResponse<{
      currentChapter: { id: string; chapterNumber: number; chapterName: string } | null;
      progress: number;
      completedChapters: number;
      totalChapters: number;
      enabledKnowledgeCount: number;
      totalKnowledgeCount: number;
    }>>;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/api.ts
git commit -m "feat: add user settings API methods to lib/api.ts"
```

---

## Task 7: 创建 OnboardingGuide 组件

**Files:**
- Create: `components/OnboardingGuide.tsx`

- [ ] **Step 1: Create OnboardingGuide component**

```typescript
// components/OnboardingGuide.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { userApi } from '@/lib/api';

interface TextbookVersion {
  id: string;
  name: string;
  year: string;
}

interface OnboardingGuideProps {
  onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState(8);
  const [subject] = useState('数学'); // 目前只有数学
  const [textbooks, setTextbooks] = useState<TextbookVersion[]>([]);
  const [selectedTextbookId, setSelectedTextbookId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 加载教材列表
    const fetchTextbooks = async () => {
      try {
        // 暂时硬编码，实际应该从 API 获取
        const mockTextbooks: TextbookVersion[] = [
          { id: 'tb1', name: '人教版', year: '2024版' },
          { id: 'tb2', name: '北师大版', year: '2024版' },
        ];
        setTextbooks(mockTextbooks);
        if (mockTextbooks.length > 0) {
          setSelectedTextbookId(mockTextbooks[0].id);
        }
      } catch (error) {
        console.error('加载教材失败:', error);
      }
    };
    fetchTextbooks();
  }, []);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await userApi.updateSettings({
        selectedGrade: grade,
        selectedSubject: subject,
        selectedTextbookId,
        studyProgress: 0,
      });
      onComplete();
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface rounded-[2rem] p-8 w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  选择年级
                </h2>
                <p className="text-on-surface-variant">请选择你当前的年级</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[7, 8, 9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-4 rounded-2xl font-medium transition-all ${
                      grade === g
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {g}年级
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="menu_book" className="text-on-secondary-container" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  选择教材
                </h2>
                <p className="text-on-surface-variant">请选择你使用的教材版本</p>
              </div>

              <div className="space-y-3 mb-6">
                {textbooks.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setSelectedTextbookId(tb.id)}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                      selectedTextbookId === tb.id
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="font-medium">{tb.name}</span>
                    <span className="text-sm opacity-70">{tb.year}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-tertiary-container flex items-center justify-center mx-auto mb-4">
                  <MaterialIcon icon="check_circle" className="text-on-tertiary-container" style={{ fontSize: '32px' }} />
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface mb-2">
                  确认设置
                </h2>
                <p className="text-on-surface-variant">请确认你的选择</p>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-6 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">年级</span>
                  <span className="font-medium text-on-surface">{grade}年级</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">科目</span>
                  <span className="font-medium text-on-surface">{subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">教材</span>
                  <span className="font-medium text-on-surface">
                    {textbooks.find(tb => tb.id === selectedTextbookId)?.name}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 rounded-full bg-surface-container text-on-surface font-medium"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 py-4 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
          >
            {loading ? '保存中...' : step === 3 ? '完成' : '下一步'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/OnboardingGuide.tsx
git commit -m "feat: add OnboardingGuide component"
```

---

## Task 8: 创建 KnowledgeTreeView 组件

**Files:**
- Create: `components/KnowledgeTreeView.tsx`

- [ ] **Step 1: Create KnowledgeTreeView component**

```typescript
// components/KnowledgeTreeView.tsx
'use client';

import { useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface KnowledgePoint {
  id: string;
  name: string;
  conceptId: string;
  conceptName: string;
  enabled: boolean;
}

interface Chapter {
  id: string;
  chapterNumber: number;
  chapterName: string;
  enabled: boolean;
  knowledgePoints: KnowledgePoint[];
}

interface KnowledgeTreeViewProps {
  chapters: Chapter[];
  onToggle: (nodeId: string, nodeType: 'chapter' | 'point', enabled: boolean) => void;
  expandable?: boolean;
}

export default function KnowledgeTreeView({
  chapters,
  onToggle,
  expandable = false,
}: KnowledgeTreeViewProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(chapters.slice(0, 3).map(c => c.id)) // 默认展开前3个
  );

  const toggleChapter = (chapterId: string) => {
    if (expandable) {
      setExpandedChapters(prev => {
        const next = new Set(prev);
        if (next.has(chapterId)) {
          next.delete(chapterId);
        } else {
          next.add(chapterId);
        }
        return next;
      });
    }
  };

  const toggleExpandAll = () => {
    if (expandedChapters.size === chapters.length) {
      setExpandedChapters(new Set());
    } else {
      setExpandedChapters(new Set(chapters.map(c => c.id)));
    }
  };

  return (
    <div className="space-y-2">
      {expandable && (
        <button
          onClick={toggleExpandAll}
          className="text-sm text-primary font-medium mb-4"
        >
          {expandedChapters.size === chapters.length ? '收起全部' : '展开全部'}
        </button>
      )}

      {chapters.map((chapter) => {
        const isExpanded = expandedChapters.has(chapter.id);
        const allPointsEnabled = chapter.knowledgePoints.every(p => p.enabled);
        const somePointsEnabled = chapter.knowledgePoints.some(p => p.enabled);

        return (
          <div key={chapter.id} className="bg-surface-container-low rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleChapter(chapter.id)}
              className="w-full p-4 flex items-center gap-3"
            >
              <MaterialIcon
                icon={isExpanded ? 'expand_more' : 'chevron_right'}
                className="text-on-surface-variant"
                style={{ fontSize: '20px' }}
              />
              <input
                type="checkbox"
                checked={allPointsEnabled}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = somePointsEnabled && !allPointsEnabled;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle(chapter.id, 'chapter', e.target.checked);
                }}
                className="w-5 h-5 rounded"
              />
              <span className="flex-1 text-left font-medium text-on-surface">
                第{chapter.chapterNumber}章 {chapter.chapterName}
              </span>
              <span className="text-sm text-on-surface-variant">
                {chapter.knowledgePoints.filter(p => p.enabled).length}/{chapter.knowledgePoints.length}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {chapter.knowledgePoints.map((point) => (
                  <div
                    key={point.id}
                    className="flex items-center gap-3 p-3 bg-surface rounded-xl"
                  >
                    <div className="w-5" /> {/* spacer */}
                    <input
                      type="checkbox"
                      checked={point.enabled}
                      onChange={(e) => {
                        onToggle(point.id, 'point', e.target.checked);
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="flex-1 text-sm text-on-surface">
                      {point.name}
                    </span>
                    <span className="text-xs text-on-surface-variant bg-surface-container-low px-2 py-1 rounded-full">
                      {point.conceptName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/KnowledgeTreeView.tsx
git commit -m "feat: add KnowledgeTreeView component"
```

---

## Task 9: 创建 LearningSettings 组件

**Files:**
- Create: `components/LearningSettings.tsx`

- [ ] **Step 1: Create LearningSettings component**

```typescript
// components/LearningSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';
import KnowledgeTreeView from './KnowledgeTreeView';
import { userApi } from '@/lib/api';

interface LearningSettingsProps {
  onRefresh?: () => void;
}

export default function LearningSettings({ onRefresh }: LearningSettingsProps) {
  const [mode, setMode] = useState<'smart' | 'manual'>('smart');
  const [settings, setSettings] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [treeData, setTreeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, treeRes] = await Promise.all([
        userApi.getSettings(),
        userApi.getKnowledgeTree(false),
      ]);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (treeRes.data) {
        setTreeData(treeRes.data);
        setProgress(settingsRes.data?.studyProgress ?? 0);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyRecommend = async () => {
    setSaving(true);
    try {
      const res = await userApi.recommend(false);
      if (res.data?.executed) {
        await loadSettings();
        onRefresh?.();
      }
    } catch (error) {
      console.error('应用推荐失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (nodeId: string, nodeType: 'chapter' | 'point', enabled: boolean) => {
    try {
      await userApi.toggleKnowledge({
        nodeId,
        nodeType,
        enabled,
        cascade: nodeType === 'chapter',
      });
      await loadSettings();
      onRefresh?.();
    } catch (error) {
      console.error('切换失败:', error);
    }
  };

  const handleProgressChange = async (value: number) => {
    setProgress(value);
    try {
      await userApi.updateSettings({ studyProgress: value });
      onRefresh?.();
    } catch (error) {
      console.error('保存进度失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!settings || !treeData) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <p className="text-center text-on-surface-variant">请先完成学习设置</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="school" className="text-primary" style={{ fontSize: '22px' }} />
        </div>
        <h3 className="font-bold text-on-surface">学习设置</h3>
      </div>

      {/* 设置摘要 */}
      <div className="bg-surface rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">
            {settings.selectedGrade}年级 · {settings.selectedSubject}
          </span>
          <span className="text-sm text-on-surface-variant">
            {treeData.enabledCount}/{treeData.totalCount} 知识点
          </span>
        </div>
      </div>

      {/* 进度滑块 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-on-surface-variant">学习进度</span>
          <span className="text-sm font-medium text-primary">{progress}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => handleProgressChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('smart')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            mode === 'smart'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant'
          }`}
        >
          智能推荐
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-3 rounded-xl font-medium transition-all ${
            mode === 'manual'
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-on-surface-variant'
          }`}
        >
          手动勾选
        </button>
      </div>

      {/* 内容区域 */}
      {mode === 'smart' ? (
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">
            根据当前进度 ({progress}%) 推荐学习内容
          </p>
          <button
            onClick={handleApplyRecommend}
            disabled={saving}
            className="bg-primary text-on-primary rounded-full py-4 px-8 font-medium disabled:opacity-50"
          >
            {saving ? '应用中...' : '应用推荐'}
          </button>
        </div>
      ) : (
        <KnowledgeTreeView
          chapters={treeData.chapters}
          onToggle={handleToggle}
          expandable={true}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add LearningSettings component"
```

---

## Task 10: 集成到 /me 页面

**Files:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: Modify /me page to include LearningSettings**

```typescript
// 在 app/me/page.tsx 顶部添加导入
import LearningSettings from '@/components/LearningSettings';

// 在功能列表中添加（在"退出登录"按钮之前）

<LearningSettings onRefresh={() => {
  // 刷新统计数据
}} />

{/* 保留原有的退出登录按钮 */}
```

完整修改：

```typescript
// 在 return 语句中，找到功能列表部分，在退出登录之前添加：

<LearningSettings
  onRefresh={() => {
    Promise.all([
      fetch('/api/auth/session').then(res => res.json()),
      fetch('/api/analytics/overview').then(res => res.json()).catch(() => ({ overview: null }))
    ]).then(([sessionData, analyticsData]) => {
      if (sessionData && sessionData.user) {
        setUser(sessionData.user);
        if (analyticsData.overview) {
          setStats({
            currentScore: analyticsData.overview.averageScore,
            targetScore: 90,
            totalAttempts: analyticsData.overview.totalAttempts,
            avgScore: analyticsData.overview.averageScore,
            totalQuestions: analyticsData.overview.totalQuestions ?? 0,
            correctRate: analyticsData.overview.correctRate ?? 0,
            recentAttempts: [],
            weakKnowledge: [],
            streak: 0,
          });
        }
      }
    });
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/me/page.tsx
git commit -m "feat: integrate LearningSettings into /me page"
```

---

## Task 11: 集成 OnboardingGuide 到测评结果页面

**Files:**
- Modify: `app/assessment/result/page.tsx` 或 `components/HomePage.tsx`

- [ ] **Step 1: Check if OnboardingGuide is needed and show**

```typescript
// 在 components/HomePage.tsx 中

import OnboardingGuide from './OnboardingGuide';

// 在 HomePage 组件中添加状态
const [showOnboarding, setShowOnboarding] = useState(false);

// 在 fetchStatus 函数中检查
const fetchStatus = async () => {
  try {
    const overviewRes = await analyticsApi.getOverview();
    const overview = overviewRes.data?.overview || overviewRes.overview;

    // 检查是否已完成测评但未设置教材
    const needsOnboarding = overview?.initialAssessmentCompleted && !overview?.selectedTextbookId;

    if (needsOnboarding) {
      setShowOnboarding(true);
    }

    if (overview) {
      setStatus({
        initialAssessmentCompleted: overview.initialAssessmentCompleted || overview.totalAttempts > 0,
        currentScore: overview.initialAssessmentScore || overview.averageScore || 0,
        currentLevel: 0,
      });
    }
  } catch (error: any) {
    // ... 错误处理
  } finally {
    setLoading(false);
  }
};

// 在 return 中添加
{showOnboarding && (
  <OnboardingGuide
    onComplete={() => {
      setShowOnboarding(false);
      fetchStatus(); // 刷新状态
    }}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add components/HomePage.tsx
git commit -m "feat: integrate OnboardingGuide after assessment"
```

---

## Task 12: E2E 测试 - 用户设置流程

**Files:**
- Modify: `e2e/user-settings.spec.ts`

- [ ] **Step 1: Add end-to-end user journey tests**

```typescript
// e2e/user-settings.spec.ts 添加完整流程测试

test.describe('用户设置完整流程', () => {
  test('新用户测评后显示引导并完成设置', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // 完成测评（假设已实现）
    // await page.click('text=开始精准测评');
    // ... 测评流程 ...

    // 应该显示引导
    await expect(page.locator('text=选择年级')).toBeVisible();

    // 选择年级
    await page.click('button:has-text("8年级")');
    await page.click('text=下一步');

    // 选择教材
    await page.click('text=人教版');
    await page.click('text=下一步');

    // 确认
    await page.click('text=完成');

    // 验证设置已保存
    const response = await page.request.get('/api/user/settings');
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.selectedGrade).toBe(8);
  });

  test('/me 页面显示学习设置', async ({ page }) => {
    // 登录并完成设置
    await page.goto('/me');
    await expect(page.locator('text=学习设置')).toBeVisible();

    // 切换到手动勾选模式
    await page.click('text=手动勾选');

    // 应该显示知识点树
    await expect(page.locator('text=第')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm test -- e2e/user-settings.spec.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/user-settings.spec.ts
git commit -m "test: add E2E tests for user settings flow"
```

---

## Task 13: 练习/测评使用知识点列表（可选扩展）

**Files:**
- Modify: `app/practice/page.tsx` 和 `app/assessment/page.tsx`

- [ ] **Step 1: Update practice to use knowledge tree**

注意：此任务需要了解现有的题目生成逻辑，可能需要额外修改。建议先完成其他任务后，根据实际情况调整。

---

## 验证清单

完成所有任务后，验证以下功能：

- [ ] 新用户测评后显示 OnboardingGuide
- [ ] 用户可以完成年级/科目/教材设置
- [ ] /me 页面显示学习设置卡片
- [ ] 智能推荐功能正常工作
- [ ] 手动勾选知识点功能正常
- [ ] 进度滑块可以拖动并保存
- [ ] API 返回正确的数据格式
- [ ] E2E 测试全部通过
