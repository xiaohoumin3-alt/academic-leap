# 知识点树形筛选系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现基于年级+科目+教材版本的知识点筛选系统，支持用户勾选知识点和智能推荐

**架构:**
- 新增 TextbookVersion 和 Chapter 表存储教材章节结构
- 新增 UserEnabledKnowledge 表存储用户勾选状态
- User 表扩展添加年级/科目/教材/进度字段
- API 层提供设置和知识点树接口
- UI 层实现首次引导和设置页面

**技术栈:** Prisma, Next.js 15 App Router, React, TypeScript, SQLite

---

## 阶段1: 数据层

### Task 1: 更新 Prisma Schema - 添加新表

**文件:** `prisma/schema.prisma`

- [ ] **Step 1: 在 User 模型中添加新字段**

在 `User` 模型的 `assessments Assessment[]` 后添加：

```prisma
  // 新增：年级科目教材设置
  selectedGrade      Int?                  // 选择的年级 (7-12)
  selectedSubject    String?               // 选择的科目 (数学/物理/化学)
  selectedTextbookId String?               // 选择的教材版本ID
  studyProgress      Int       @default(0) // 学习进度百分比 0-100

  enabledKnowledge   UserEnabledKnowledge[]
```

- [ ] **Step 2: 在 UserKnowledge 模型后添加新模型**

```prisma
// 教材版本
model TextbookVersion {
  id          String   @id @default(cuid())
  name        String   // "人教版", "北师大版"
  publisher   String?  // "人民教育出版社"
  grade       Int      // 7-12
  subject     String   // "数学", "物理", "化学"
  year        String?  // "2024版"
  status      String   @default("active") // active, archived
  chapters    Chapter[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([grade, subject, name])
  @@index([grade, subject, status])
}

// 教材章节
model Chapter {
  id              String           @id @default(cuid())
  textbookId      String           // 关联教材版本
  chapterNumber   Int              // 第几章
  chapterName     String           // "有理数"
  sectionNumber   Int?             // 第几节（可选）
  sectionName     String?          // 小节名称
  parentId        String?          // 父章节ID（用于小节）
  sort            Int              @default(0)

  textbook        TextbookVersion  @relation(fields: [textbookId], references: [id])
  parent          Chapter?         @relation("ChapterHierarchy", fields: [parentId], references: [id])
  children        Chapter[]        @relation("ChapterHierarchy")
  knowledgePoints KnowledgePoint[]
  enabledBy       UserEnabledKnowledge[]

  @@index([textbookId, parentId])
}

// 用户勾选的知识点/章节
model UserEnabledKnowledge {
  id        String   @id @default(cuid())
  userId    String
  nodeId    String   // 章节ID或知识点ID
  nodeType  String   // "chapter" 或 "point"
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chapter   Chapter? @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  @@unique([userId, nodeId])
  @@index([userId, nodeType])
}
```

- [ ] **Step 3: 修改 KnowledgePoint 模型**

将 `KnowledgePoint` 模型修改为：

```prisma
// 知识点
model KnowledgePoint {
  id          String    @id @default(cuid())
  chapterId   String    // 关联章节（新增）
  name        String    // 知识点名称
  weight      Int       @default(0) // 分值权重 1-100
  inAssess    Boolean   @default(true) // 参与测评
  status      String    @default("active") // active/draft/archived
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  chapter     Chapter                @relation(fields: [chapterId], references: [id])
  histories   KnowledgePointHistory[]
  templates   Template[]
  enabledBy   UserEnabledKnowledge[]
}
```

**注意:** 移除了原有的 `subject` 和 `category` 字段，现在通过章节的教材获取。

- [ ] **Step 4: 生成并运行迁移**

```bash
cd /Users/seanxx/academic-leap/academic-leap
npx prisma migrate dev --name add_knowledge_tree
```

预期输出: 成功创建迁移文件并应用

- [ ] **Step 5: 重新生成 Prisma Client**

```bash
npx prisma generate
```

预期输出: 成功生成客户端

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add textbook version and chapter models"
```

---

### Task 2: 创建教材版本种子数据

**文件:** `prisma/seed-textbooks.ts` (新建)

- [ ] **Step 1: 创建种子数据文件**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const textbooks = [
  // 初中数学
  { grade: 7, subject: '数学', name: '人教版', publisher: '人民教育出版社', year: '2024' },
  { grade: 7, subject: '数学', name: '北师大版', publisher: '北京师范大学出版社', year: '2024' },
  { grade: 7, subject: '数学', name: '苏教版', publisher: '江苏凤凰教育出版社', year: '2024' },
  { grade: 8, subject: '数学', name: '人教版', publisher: '人民教育出版社', year: '2024' },
  { grade: 8, subject: '数学', name: '北师大版', publisher: '北京师范大学出版社', year: '2024' },
  { grade: 9, subject: '数学', name: '人教版', publisher: '人民教育出版社', year: '2024' },

  // 高中数学
  { grade: 10, subject: '数学', name: '人教A版', publisher: '人民教育出版社', year: '2024' },
  { grade: 10, subject: '数学', name: '人教B版', publisher: '人民教育出版社', year: '2024' },
  { grade: 11, subject: '数学', name: '人教A版', publisher: '人民教育出版社', year: '2024' },
  { grade: 12, subject: '数学', name: '人教A版', publisher: '人民教育出版社', year: '2024' },
];

async function main() {
  console.log('开始创建教材版本数据...');

  for (const textbook of textbooks) {
    await prisma.textbookVersion.upsert({
      where: {
        grade_subject_name: {
          grade: textbook.grade,
          subject: textbook.subject,
          name: textbook.name,
        },
      },
      update: {},
      create: textbook,
    });
  }

  console.log(`✓ 创建了 ${textbooks.length} 个教材版本`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: 在 package.json 添加 seed 脚本**

在 `package.json` 的 `scripts` 中添加：

```json
"seed:textbooks": "tsx prisma/seed-textbooks.ts"
```

- [ ] **Step 3: 运行种子数据脚本**

```bash
npm run seed:textbooks
```

预期输出: `✓ 创建了 11 个教材版本`

- [ ] **Step 4: 提交**

```bash
git add prisma/seed-textbooks.ts package.json
git commit -m "feat: add textbook seed data"
```

---

### Task 3: 创建数据迁移脚本

**文件:** `scripts/migrate-knowledge-points.ts` (新建)

- [ ] **Step 1: 创建迁移脚本**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateKnowledgePoints() {
  console.log('开始迁移现有知识点...');

  // 1. 获取所有现有知识点
  const existingPoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
  });

  console.log(`找到 ${existingPoints.length} 个现有知识点`);

  // 2. 为每个年级+科目组合创建一个"未分类"章节
  const combinations = new Map<string, string>(); // "7-数学" -> chapterId

  for (const point of existingPoints) {
    const key = `${point.subject === '初中' ? '7' : '10'}-数学`;
    
    if (!combinations.has(key)) {
      // 创建教材版本（如果不存在）
      const grade = point.subject === '初中' ? 7 : 10;
      const textbook = await prisma.textbookVersion.upsert({
        where: {
          grade_subject_name: {
            grade,
            subject: '数学',
            name: '人教版',
          },
        },
        update: {},
        create: {
          grade,
          subject: '数学',
          name: '人教版',
          year: '2024',
        },
      });

      // 创建未分类章节
      const chapter = await prisma.chapter.create({
        data: {
          textbookId: textbook.id,
          chapterNumber: 0,
          chapterName: '未分类（迁移数据）',
          sort: 999,
        },
      });

      combinations.set(key, chapter.id);
      console.log(`创建章节: ${key}`);
    }

    // 3. 更新知识点，关联到章节
    const chapterId = combinations.get(key)!;
    await prisma.knowledgePoint.update({
      where: { id: point.id },
      data: { chapterId },
    });
  }

  console.log('✓ 知识点迁移完成');
}

migrateKnowledgePoints()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: 创建 scripts 目录（如果不存在）**

```bash
mkdir -p /Users/seanxx/academic-leap/academic-leap/scripts
```

- [ ] **Step 3: 运行迁移脚本**

```bash
npx tsx scripts/migrate-knowledge-points.ts
```

预期输出: `✓ 知识点迁移完成`

- [ ] **Step 4: 提交**

```bash
git add scripts/migrate-knowledge-points.ts
git commit -m "feat: add knowledge point migration script"
```

---

## 阶段2: API 层

### Task 4: 用户设置 API

**文件:** `app/api/user/settings/route.ts` (新建)

- [ ] **Step 1: 创建 GET 处理函数**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/settings - 获取用户设置
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
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
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 获取教材名称
    let textbookName = null;
    if (user.selectedTextbookId) {
      const textbook = await prisma.textbookVersion.findUnique({
        where: { id: user.selectedTextbookId },
        select: { name: true, year: true },
      });
      if (textbook) {
        textbookName = `${textbook.name}${textbook.year ? ' ' + textbook.year : ''}`;
      }
    }

    return NextResponse.json({
      grade: user.selectedGrade,
      subject: user.selectedSubject,
      textbookId: user.selectedTextbookId,
      textbookName,
      progress: user.studyProgress,
    });
  } catch (error) {
    console.error('获取用户设置失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 添加 PUT 处理函数**

在同一文件中添加：

```typescript
// PUT /api/user/settings - 更新用户设置
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { grade, subject, textbookId } = body;

    // 验证教材是否存在
    if (textbookId) {
      const textbook = await prisma.textbookVersion.findUnique({
        where: { id: textbookId },
      });
      if (!textbook) {
        return NextResponse.json({ error: '教材不存在' }, { status: 400 });
      }
    }

    // 更新用户设置
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        selectedGrade: grade,
        selectedSubject: subject,
        selectedTextbookId: textbookId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户设置失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/user/settings/route.ts
git commit -m "feat: add user settings API"
```

---

**文件:** `app/api/user/settings/progress/route.ts` (新建)

- [ ] **Step 4: 创建进度更新 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/user/settings/progress - 更新学习进度
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { progress } = body;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return NextResponse.json({ error: '进度值无效' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { studyProgress: progress },
    });

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    console.error('更新学习进度失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add app/api/user/settings/progress/route.ts
git commit -m "feat: add progress update API"
```

---

### Task 5: 教材列表 API

**文件:** `app/api/textbooks/route.ts` (新建)

- [ ] **Step 1: 创建教材列表 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/textbooks - 获取教材列表
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const subject = searchParams.get('subject');

    const where: any = { status: 'active' };
    if (grade) where.grade = parseInt(grade);
    if (subject) where.subject = subject;

    const textbooks = await prisma.textbookVersion.findMany({
      where,
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        publisher: true,
        year: true,
      },
    });

    return NextResponse.json({ textbooks });
  } catch (error) {
    console.error('获取教材列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/textbooks/route.ts
git commit -m "feat: add textbooks list API"
```

---

### Task 6: 知识点树 API

**文件:** `app/api/knowledge/tree/route.ts` (新建)

- [ ] **Step 1: 创建知识点树 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface TreeNode {
  id: string;
  type: 'chapter' | 'point';
  name: string;
  number: string;
  enabled: boolean;
  children?: TreeNode[];
}

// 构建树形结构
function buildTree(
  chapters: any[],
  userEnabled: Set<string>
): TreeNode[] {
  const chapterMap = new Map<string, any[]>();
  const rootChapters: any[] = [];

  // 分组：父章节
  for (const chapter of chapters) {
    if (chapter.parentId) {
      if (!chapterMap.has(chapter.parentId)) {
        chapterMap.set(chapter.parentId, []);
      }
      chapterMap.get(chapter.parentId).push(chapter);
    } else {
      rootChapters.push(chapter);
    }
  }

  // 递归构建树
  function buildNode(chapter: any): TreeNode {
    const node: TreeNode = {
      id: chapter.id,
      type: 'chapter',
      name: chapter.sectionName 
        ? `${chapter.chapterNumber}.${chapter.sectionNumber} ${chapter.sectionName}`
        : `${chapter.chapterNumber} ${chapter.chapterName}`,
      number: chapter.sectionNumber 
        ? `${chapter.chapterNumber}.${chapter.sectionNumber}`
        : String(chapter.chapterNumber),
      enabled: userEnabled.has(chapter.id),
    };

    // 添加子章节
    const children = chapterMap.get(chapter.id);
    if (children && children.length > 0) {
      node.children = children.map(buildNode);
    }

    // 添加知识点
    if (chapter.knowledgePoints && chapter.knowledgePoints.length > 0) {
      if (!node.children) node.children = [];
      for (const point of chapter.knowledgePoints) {
        node.children.push({
          id: point.id,
          type: 'point' as const,
          name: point.name,
          number: '',
          enabled: userEnabled.has(point.id),
        });
      }
    }

    return node;
  }

  return rootChapters.map(buildNode);
}

// GET /api/knowledge/tree - 获取知识点树
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const textbookId = searchParams.get('textbookId');

    if (!textbookId) {
      return NextResponse.json({ error: '缺少教材ID' }, { status: 400 });
    }

    // 获取用户勾选的节点
    const userEnabled = await prisma.userEnabledKnowledge.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        nodeId: true,
      },
    });
    const enabledSet = new Set(userEnabled.map((e) => e.nodeId));

    // 获取章节和知识点
    const chapters = await prisma.chapter.findMany({
      where: {
        textbookId,
      },
      include: {
        knowledgePoints: {
          where: { status: 'active', deletedAt: null },
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ chapterNumber: 'asc' }, { sectionNumber: 'asc' }],
    });

    const tree = buildTree(chapters, enabledSet);

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('获取知识点树失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/knowledge/tree/route.ts
git commit -m "feat: add knowledge tree API"
```

---

### Task 7: 知识点勾选 API

**文件:** `app/api/knowledge/enable/route.ts` (新建)

- [ ] **Step 1: 创建勾选/取消勾选 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 递归获取所有子节点ID
async function getAllChildNodeIds(chapterId: string): Promise<string[]> {
  const ids: string[] = [chapterId];

  // 获取子章节
  const children = await prisma.chapter.findMany({
    where: { parentId: chapterId },
    select: { id: true },
  });

  for (const child of children) {
    ids.push(...await getAllChildNodeIds(child.id));
  }

  // 获取知识点
  const points = await prisma.knowledgePoint.findMany({
    where: {
      chapterId,
      status: 'active',
      deletedAt: null,
    },
    select: { id: true },
  });

  ids.push(...points.map((p) => p.id));

  return ids;
}

// PUT /api/knowledge/enable - 勾选/取消勾选节点
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { nodeId, nodeType, enabled } = body;

    if (!nodeId || !nodeType || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    const userId = session.user.id;
    const affectedIds: string[] = [];

    if (nodeType === 'chapter') {
      // 获取所有子节点
      const childIds = await getAllChildNodeIds(nodeId);
      affectedIds.push(...childIds);

      // 批量操作
      if (enabled) {
        // 勾选：创建所有子节点记录
        for (const id of childIds) {
          await prisma.userEnabledKnowledge.upsert({
            where: {
              userId_nodeId: {
                userId,
                nodeId: id,
              },
            },
            update: {},
            create: {
              userId,
              nodeId: id,
              nodeType: id === nodeId ? 'chapter' : 'point',
            },
          });
        }
      } else {
        // 取消勾选：删除所有子节点记录
        await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId,
            nodeId: { in: childIds },
          },
        });
      }
    } else {
      // 知识点：直接操作
      affectedIds.push(nodeId);

      if (enabled) {
        await prisma.userEnabledKnowledge.upsert({
          where: {
            userId_nodeId: {
              userId,
              nodeId,
            },
          },
          update: {},
          create: {
            userId,
            nodeId,
            nodeType: 'point',
          },
        });
      } else {
        await prisma.userEnabledKnowledge.deleteMany({
          where: { userId, nodeId },
        });
      }
    }

    return NextResponse.json({
      success: true,
      affected: affectedIds,
    });
  } catch (error) {
    console.error('更新勾选状态失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/knowledge/enable/route.ts
git commit -m "feat: add knowledge enable/disable API"
```

---

### Task 8: 智能推荐 API

**文件:** `app/api/knowledge/smart-enable/route.ts` (新建)

- [ ] **Step 1: 创建智能推荐 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 获取顶层章节
async function getTopLevelChapters(textbookId: string) {
  return prisma.chapter.findMany({
    where: {
      textbookId,
      parentId: null,
    },
    orderBy: { chapterNumber: 'asc' },
    select: {
      id: true,
      chapterNumber: true,
    },
  });
}

// 递归展平章节树
async function flattenChapterTree(chapterIds: string[]): Promise<string[]> {
  const result: string[] = [];

  for (const chapterId of chapterIds) {
    result.push(chapterId);

    // 子章节
    const children = await prisma.chapter.findMany({
      where: { parentId: chapterId },
      select: { id: true },
    });
    if (children.length > 0) {
      const childIds = children.map((c) => c.id);
      result.push(...await flattenChapterTree(childIds));
    }

    // 知识点
    const points = await prisma.knowledgePoint.findMany({
      where: {
        chapterId,
        status: 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    result.push(...points.map((p) => p.id));
  }

  return result;
}

// POST /api/knowledge/smart-enable - 智能推荐
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { progress } = body;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return NextResponse.json({ error: '进度值无效' }, { status: 400 });
    }

    const userId = session.user.id;

    // 获取用户当前选择的教材
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTextbookId: true },
    });

    if (!user?.selectedTextbookId) {
      return NextResponse.json({ error: '请先选择教材' }, { status: 400 });
    }

    // 获取顶层章节数量
    const chapters = await getTopLevelChapters(user.selectedTextbookId);
    const totalChapters = chapters.length;

    // 计算应推荐的章节数
    const targetChapterCount = Math.max(1, Math.floor(totalChapters * progress / 100));
    const targetChapters = chapters.slice(0, targetChapterCount);

    // 展平章节树
    const allNodeIds = await flattenChapterTree(targetChapters.map((c) => c.id));

    // 批量勾选
    for (const nodeId of allNodeIds) {
      await prisma.userEnabledKnowledge.upsert({
        where: {
          userId_nodeId: {
            userId,
            nodeId,
          },
        },
        update: {},
        create: {
          userId,
          nodeId,
          nodeType: 'point',
        },
      });
    }

    // 更新用户进度
    await prisma.user.update({
      where: { id: userId },
      data: { studyProgress: progress },
    });

    return NextResponse.json({
      success: true,
      enabled: allNodeIds,
      message: `已推荐前 ${targetChapterCount} 章内容`,
    });
  } catch (error) {
    console.error('智能推荐失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/knowledge/smart-enable/route.ts
git commit -m "feat: add smart recommend API"
```

---

### Task 9: 修改题目 API 支持筛选

**文件:** `app/api/questions/route.ts`

- [ ] **Step 1: 修改查询逻辑**

找到现有的题目查询逻辑，添加筛选条件。在 `where` 条件中添加：

```typescript
// 根据用户设置筛选知识点
const session = await auth();
let enabledKnowledgeIds: string[] = [];

if (session?.user?.id) {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      selectedGrade: true,
      selectedSubject: true,
      selectedTextbookId: true,
      enabledKnowledge: {
        select: { nodeId: true },
      },
    },
  });

  if (user?.enabledKnowledge) {
    enabledKnowledgeIds = user.enabledKnowledge.map((e) => e.nodeId);
  }
}

// 在题目查询中添加筛选
const where: any = {};

if (enabledKnowledgeIds.length > 0) {
  // 通过知识点章节筛选
  const questionsInScope = await prisma.knowledgePoint.findMany({
    where: {
      id: { in: enabledKnowledgeIds },
      status: 'active',
      deletedAt: null,
    },
    select: { id: true },
  });

  const knowledgeIds = questionsInScope.map((k) => k.id);
  if (knowledgeIds.length > 0) {
    where.knowledgePoints = {
      array_contains: JSON.stringify(knowledgeIds),
    };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/questions/route.ts
git commit -m "feat: add knowledge filter to questions API"
```

---

## 阶段3: UI 组件

### Task 10: 创建知识点树组件

**文件:** `components/KnowledgeTree.tsx` (新建)

- [ ] **Step 1: 创建知识点树组件**

```typescript
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { cn } from '@/lib/utils';

export interface TreeNode {
  id: string;
  type: 'chapter' | 'point';
  name: string;
  number: string;
  enabled: boolean;
  children?: TreeNode[];
}

interface KnowledgeTreeProps {
  tree: TreeNode[];
  onToggle: (nodeId: string, enabled: boolean, nodeType: string) => void;
  searchQuery?: string;
}

export const KnowledgeTree: React.FC<KnowledgeTreeProps> = ({
  tree,
  onToggle,
  searchQuery = '',
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [indeterminateIds, setIndeterminateIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggle = (node: TreeNode, enabled: boolean) => {
    onToggle(node.id, enabled, node.type);
  };

  // 过滤树节点
  const filterTree = (nodes: TreeNode[]): TreeNode[] => {
    if (!searchQuery) return nodes;

    return nodes.reduce((acc: TreeNode[], node) => {
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children) : [];

      if (matchesSearch || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }

      return acc;
    }, []);
  };

  const filteredTree = filterTree(tree);

  const renderNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isChapter = node.type === 'chapter';

    return (
      <div key={node.id} className={cn(level > 0 && 'ml-4')}>
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 rounded-xl',
            'hover:bg-surface-container-high cursor-pointer',
            'transition-colors'
          )}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 hover:bg-surface-variant rounded-lg"
            >
              <MaterialIcon
                icon={isExpanded ? 'expand_more' : 'chevron_right'}
                className="text-on-surface-variant"
                style={{ fontSize: '20px' }}
              />
            </button>
          )}
          {!hasChildren && <div className="w-8" />}
          
          <button
            onClick={() => handleToggle(node, !node.enabled)}
            className={cn(
              'w-6 h-6 rounded-md border-2 flex items-center justify-center',
              'transition-all',
              node.enabled
                ? 'bg-primary border-primary text-on-primary'
                : 'border-outline-variant'
            )}
          >
            {node.enabled && (
              <MaterialIcon icon="check" style={{ fontSize: '16px' }} />
            )}
          </button>

          <span className={cn(
            'flex-1 text-sm font-medium',
            node.enabled ? 'text-on-surface' : 'text-on-surface-variant'
          )}>
            {node.name}
          </span>
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {node.children?.map((child) => renderNode(child, level + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (filteredTree.length === 0) {
    return (
      <div className="text-center py-8 text-on-surface-variant">
        <MaterialIcon icon="search_off" className="text-4xl mb-2" />
        <p>没有找到匹配的知识点</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filteredTree.map((node) => renderNode(node))}
    </div>
  );
};

export default KnowledgeTree;
```

- [ ] **Step 2: 提交**

```bash
git add components/KnowledgeTree.tsx
git commit -m "feat: add KnowledgeTree component"
```

---

### Task 11: 创建首次引导组件

**文件:** `components/OnboardingWizard.tsx` (新建)

- [ ] **Step 1: 创建首次引导组件**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from 'next-auth/react';
import MaterialIcon from './MaterialIcon';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'grade' | 'subject' | 'textbook' | 'progress' | 'complete';

const GRADES = [
  { value: 7, label: '初一' },
  { value: 8, label: '初二' },
  { value: 9, label: '初三' },
  { value: 10, label: '高一' },
  { value: 11, label: '高二' },
  { value: 12, label: '高三' },
];

const SUBJECTS = [
  { value: '数学', label: '数学' },
  { value: '物理', label: '物理' },
  { value: '化学', label: '化学' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
}) => {
  const { data: session } = useSession();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedGrade, setSelectedGrade] = useState<number>(7);
  const [selectedSubject, setSelectedSubject] = useState<string>('数学');
  const [selectedTextbook, setSelectedTextbook] = useState<string>('');
  const [progress, setProgress] = useState<number>(40);
  const [textbooks, setTextbooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载教材列表
  useEffect(() => {
    if (step === 'textbook') {
      fetch(`/api/textbooks?grade=${selectedGrade}&subject=${selectedSubject}`)
        .then((res) => res.json())
        .then((data) => {
          setTextbooks(data.textbooks || []);
          if (data.textbooks?.length > 0) {
            setSelectedTextbook(data.textbooks[0].id);
          }
        });
    }
  }, [step, selectedGrade, selectedSubject]);

  // 计算默认进度
  useEffect(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 8, 1); // 9月1日
    const yearEnd = new Date(now.getFullYear() + 1, 0, 31); // 1月底
    const total = yearEnd.getTime() - yearStart.getTime();
    const elapsed = now.getTime() - Math.min(yearStart.getTime(), now.getTime());
    const defaultProgress = Math.min(100, Math.max(0, Math.floor((elapsed / total) * 100)));
    setProgress(defaultProgress);
  }, []);

  const handleNext = async () => {
    if (step === 'complete') {
      await handleSubmit();
    } else {
      const steps: Step[] = ['welcome', 'grade', 'subject', 'textbook', 'progress', 'complete'];
      const currentIndex = steps.indexOf(step);
      setStep(steps[currentIndex + 1]);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: selectedGrade,
          subject: selectedSubject,
          textbookId: selectedTextbook,
        }),
      });

      if (res.ok) {
        // 调用智能推荐
        await fetch('/api/knowledge/smart-enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress }),
        });
        onComplete();
      }
    } finally {
      setLoading(false);
    }
  };

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-primary-container rounded-full flex items-center justify-center mx-auto">
        <MaterialIcon icon="school" className="text-4xl text-on-primary-container" />
      </div>
      <div>
        <h2 className="text-2xl font-display font-black text-on-surface mb-2">
          欢迎使用学力跃迁
        </h2>
        <p className="text-on-surface-variant">
          为了提供更精准的练习内容，请先设置您的学习信息
        </p>
      </div>
    </div>
  );

  const renderGrade = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-black text-on-surface text-center">
        选择您的年级
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {GRADES.map((grade) => (
          <button
            key={grade.value}
            onClick={() => setSelectedGrade(grade.value)}
            className={cn(
              'py-4 px-6 rounded-2xl font-display font-black text-lg',
              'transition-all active:scale-95',
              selectedGrade === grade.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            )}
          >
            {grade.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderSubject = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-black text-on-surface text-center">
        选择科目
      </h3>
      <div className="space-y-3">
        {SUBJECTS.map((subject) => (
          <button
            key={subject.value}
            onClick={() => setSelectedSubject(subject.value)}
            className={cn(
              'w-full py-4 px-6 rounded-2xl font-display font-black text-lg',
              'transition-all active:scale-95',
              selectedSubject === subject.value
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            )}
          >
            {subject.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderTextbook = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-black text-on-surface text-center">
        选择教材版本
      </h3>
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {textbooks.map((textbook) => (
          <button
            key={textbook.id}
            onClick={() => setSelectedTextbook(textbook.id)}
            className={cn(
              'w-full py-4 px-6 rounded-2xl font-display font-bold text-left',
              'transition-all active:scale-95',
              selectedTextbook === textbook.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant'
            )}
          >
            {textbook.name}
            {textbook.year && <span className="text-sm opacity-70"> · {textbook.year}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-display font-black text-on-surface text-center">
        设置学习进度
      </h3>
      <div className="text-center">
        <span className="text-5xl font-display font-black text-primary">{progress}%</span>
        <p className="text-on-surface-variant mt-2">
          即将推荐前 {Math.floor(progress)}% 的章节内容
        </p>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={progress}
        onChange={(e) => setProgress(parseInt(e.target.value))}
        className="w-full h-3 bg-surface-container-high rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-surface-container-high) ${progress}%)`,
        }}
      />
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="w-24 h-24 bg-success rounded-full flex items-center justify-center mx-auto">
        <MaterialIcon icon="check" className="text-4xl text-on-success" />
      </div>
      <div>
        <h2 className="text-2xl font-display font-black text-on-surface mb-2">
          设置完成！
        </h2>
        <p className="text-on-surface-variant">
          系统已根据您的设置智能推荐知识点
        </p>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (step) {
      case 'welcome': return '欢迎';
      case 'grade': return '年级';
      case 'subject': return '科目';
      case 'textbook': return '教材';
      case 'progress': return '进度';
      case 'complete': return '完成';
    }
  };

  return (
    <div className="fixed inset-0 bg-surface z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 shadow-2xl"
      >
        {/* 进度指示 */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-sm font-bold text-on-surface-variant">步骤</span>
          <div className="flex gap-2">
            {['welcome', 'grade', 'subject', 'textbook', 'progress', 'complete'].map((s, i) => (
              <div
                key={s}
                className={cn(
                  'w-2 h-2 rounded-full',
                  step === s
                    ? 'bg-primary'
                    : ['welcome', 'grade', 'subject', 'textbook', 'progress', 'complete'].indexOf(step) > i
                    ? 'bg-primary/30'
                    : 'bg-surface-variant'
                )}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-on-surface-variant">{getStepTitle()}</span>
        </div>

        {/* 内容 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 'welcome' && renderWelcome()}
            {step === 'grade' && renderGrade()}
            {step === 'subject' && renderSubject()}
            {step === 'textbook' && renderTextbook()}
            {step === 'progress' && renderProgress()}
            {step === 'complete' && renderComplete()}
          </motion.div>
        </AnimatePresence>

        {/* 按钮 */}
        <div className="mt-8 flex gap-3">
          {step !== 'welcome' && step !== 'complete' && (
            <button
              onClick={() => {
                const steps: Step[] = ['welcome', 'grade', 'subject', 'textbook', 'progress', 'complete'];
                const currentIndex = steps.indexOf(step);
                setStep(steps[currentIndex - 1]);
              }}
              className="flex-1 py-4 rounded-full bg-surface-container font-display font-bold text-on-surface active:scale-95 transition-all"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 py-4 rounded-full bg-primary text-on-primary font-display font-black active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '保存中...' : step === 'complete' ? '开始学习' : '下一步'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
```

- [ ] **Step 2: 提交**

```bash
git add components/OnboardingWizard.tsx
git commit -m "feat: add OnboardingWizard component"
```

---

### Task 12: 创建设置页面

**文件:** `app/settings/page.tsx` (新建)

- [ ] **Step 1: 创建设置页面**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useSession } from 'next-auth/react';
import MaterialIcon from '@/components/MaterialIcon';
import { KnowledgeTree, TreeNode } from '@/components/KnowledgeTree';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 用户设置
  const [grade, setGrade] = useState<number>(7);
  const [subject, setSubject] = useState<string>('数学');
  const [textbookId, setTextbookId] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [textbookName, setTextbookName] = useState<string>('');
  
  // 知识点树
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 加载设置
  useEffect(() => {
    if (session?.user) {
      loadSettings();
    }
  }, [session]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, treeRes] = await Promise.all([
        fetch('/api/user/settings'),
        fetch(`/api/knowledge/tree?textbookId=${textbookId || 'default'}`),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setGrade(data.grade || 7);
        setSubject(data.subject || '数学');
        setTextbookId(data.textbookId || '');
        setProgress(data.progress || 0);
        setTextbookName(data.textbookName || '');
      }

      if (treeRes.ok && textbookId) {
        const data = await treeRes.json();
        setTree(data.tree || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, subject, textbookId }),
      });
      alert('设置已保存');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (nodeId: string, enabled: boolean, nodeType: string) => {
    await fetch('/api/knowledge/enable', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, nodeType, enabled }),
    });
    
    // 更新本地状态
    const updateTree = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, enabled };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };
    
    setTree(updateTree(tree));
  };

  const handleSmartRecommend = async () => {
    const res = await fetch('/api/knowledge/smart-enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    });
    
    if (res.ok) {
      loadSettings();
      alert('智能推荐已应用');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-32">
      {/* Header */}
      <div className="bg-surface-container-lowest px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2">
          <MaterialIcon icon="arrow_back" className="text-on-surface" />
        </button>
        <h1 className="text-xl font-display font-black text-on-surface">设置</h1>
      </div>

      <div className="p-6 space-y-6">
        {/* 学习设置 */}
        <section className="bg-surface-container-low rounded-3xl p-6">
          <h2 className="text-lg font-display font-black text-on-surface mb-4">学习设置</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">年级</span>
              <span className="font-bold text-on-surface">{grade}年级</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">科目</span>
              <span className="font-bold text-on-surface">{subject}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">教材</span>
              <span className="font-bold text-on-surface">{textbookName || '未选择'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">进度</span>
              <span className="font-bold text-primary">{progress}%</span>
            </div>
          </div>
        </section>

        {/* 知识点选择 */}
        <section className="bg-surface-container-low rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-black text-on-surface">知识点选择</h2>
          </div>

          {/* 搜索 */}
          <div className="relative mb-4">
            <MaterialIcon icon="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="搜索知识点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface-container rounded-xl text-on-surface placeholder:text-on-surface-variant"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleSmartRecommend}
              className="flex-1 py-3 px-4 bg-primary-container text-on-primary-container rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <MaterialIcon icon="auto_awesome" />
              智能推荐
            </button>
            <button
              onClick={() => {/* 全选 */}}
              className="py-3 px-4 bg-surface-container rounded-xl font-bold active:scale-95 transition-all"
            >
              全选
            </button>
            <button
              onClick={() => {/* 清空 */}}
              className="py-3 px-4 bg-surface-container rounded-xl font-bold active:scale-95 transition-all"
            >
              清空
            </button>
          </div>

          {/* 知识点树 */}
          <div className="max-h-96 overflow-y-auto">
            <KnowledgeTree tree={tree} onToggle={handleToggle} searchQuery={searchQuery} />
          </div>
        </section>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-display font-black text-lg active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add app/settings/page.tsx
git commit -m "feat: add settings page"
```

---

## 阶段4: 集成

### Task 13: 首页集成首次引导

**文件:** `app/page.tsx`

- [ ] **Step 1: 添加首次引导检测**

在首页组件中添加：

```typescript
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import OnboardingWizard from '@/components/OnboardingWizard';

// 在组件内
const { data: session, status } = useSession();
const [showOnboarding, setShowOnboarding] = useState(false);

useEffect(() => {
  if (status === 'authenticated' && session?.user) {
    // 检查是否需要首次引导
    fetch('/api/user/settings')
      .then((res) => res.json())
      .then((data) => {
        if (!data.grade || !data.subject || !data.textbookId) {
          setShowOnboarding(true);
        }
      });
  }
}, [status, session]);

// 在返回的 JSX 中添加
{showOnboarding && (
  <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
)}
```

- [ ] **Step 2: 提交**

```bash
git add app/page.tsx
git commit -m "feat: integrate onboarding wizard to homepage"
```

---

### Task 14: 底部导航添加设置入口

**文件:** `components/BottomNavigation.tsx`

- [ ] **Step 1: 添加设置按钮**

在导航项中添加设置入口：

```typescript
// 在导航项数组中添加
{
  icon: 'settings',
  label: '设置',
  href: '/settings',
},
```

- [ ] **Step 2: 提交**

```bash
git add components/BottomNavigation.tsx
git commit -m "feat: add settings to bottom navigation"
```

---

## 验证

### Task 15: 端到端测试

- [ ] **Step 1: 测试首次引导流程**

1. 清空用户设置（或使用新用户注册）
2. 访问首页，应显示首次引导
3. 依次完成：选择年级 → 选择科目 → 选择教材 → 设置进度
4. 完成后应自动跳转首页，智能推荐已应用

- [ ] **Step 2: 测试设置页面**

1. 点击底部导航"设置"
2. 验证年级、科目、教材、进度显示正确
3. 搜索知识点功能正常
4. 勾选/取消勾选知识点正常
5. 智能推荐功能正常

- [ ] **Step 3: 测试题目筛选**

1. 设置不同的知识点勾选状态
2. 进入练习页面
3. 验证只出现勾选知识点相关的题目

- [ ] **Step 4: 提交验证通过**

```bash
git add .
git commit -m "test: verify knowledge tree filter system E2E"
```

---

## 完成检查清单

- [ ] 数据库迁移成功应用
- [ ] 种子数据已创建
- [ ] 现有知识点已迁移
- [ ] 所有 API 端点正常工作
- [ ] 首次引导流程完整
- [ ] 设置页面功能正常
- [ ] 知识点树组件正常渲染
- [ ] 题目筛选正确应用
- [ ] 底部导航包含设置入口

---

## 回滚计划

如需回滚：

```bash
# 回滚数据库迁移
npx prisma migrate resolve --rolled-back [migration_name]

# 恢复代码
git revert [commit_range]

# 清理缓存
rm -rf .next
npm run dev
```
