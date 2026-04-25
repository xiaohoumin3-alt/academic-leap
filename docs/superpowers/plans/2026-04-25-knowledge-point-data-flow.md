# 知识点数据流重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 确保四个核心知识点（一元一次方程、二次函数、勾股定理、概率统计）在系统中一以贯之，统一使用 id 引用，添加权重管理。

**Architecture:**
- 数据层：Question.knowledgePoints 统一存储 id（非 name）
- API 层：所有查询使用 knowledgePointId
- 迁移脚本：设置权重、清理模板、验证数据

**Tech Stack:** Next.js 15, Prisma, TypeScript, React

---

## 文件结构

### 新建文件
- `scripts/set-knowledge-weights.ts` - 设置知识点权重
- `scripts/cleanup-duplicate-templates.ts` - 清理重复模板
- `scripts/validate-data-flow.ts` - 验证数据流完整性
- `app/api/user/knowledge-weight/route.ts` - 权重管理 API

### 修改文件
- `app/api/assessment/start/route.ts` - 使用 id 查询
- `app/api/practice/recommend/route.ts` - 使用 id 查询
- `app/api/practice/finish/route.ts` - 移除 name→id 转换
- `components/LearningSettings.tsx` - 添加权重管理界面

---

## Task 1: 设置知识点权重

**Files:**
- Create: `scripts/set-knowledge-weights.ts`

- [ ] **Step 1: 创建权重设置脚本**

```typescript
// scripts/set-knowledge-weights.ts
import { prisma } from '../lib/prisma';

async function setWeights() {
  // 获取四个核心知识点
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true }
  });

  const weights: Record<string, number> = {
    '一元一次方程': 3,
    '二次函数': 4,
    '勾股定理': 3,
    '概率统计': 2
  };

  for (const kp of kps) {
    await prisma.knowledgePoint.update({
      where: { id: kp.id },
      data: { weight: weights[kp.name] }
    });
    console.log(`✓ ${kp.name}: weight = ${weights[kp.name]}`);
  }

  await prisma.$disconnect();
}

setWeights().catch(console.error);
```

- [ ] **Step 2: 运行脚本验证**

Run: `npx tsx scripts/set-knowledge-weights.ts`
Expected: 输出 4 个知识点的权重设置成功

- [ ] **Step 3: 验证数据库**

Run: `npx tsx -e "import{prisma}from'./lib/prisma';prisma.knowledgePoint.findMany({where:{name:{in:['一元一次方程','二次函数','勾股定理','概率统计']}},select:{name:true,weight:true}}).then(k=>{k.forEach(kp=>console.log(kp.name,':',kp.weight));process.exit(0)});"`
Expected: 每个知识点显示正确权重

- [ ] **Step 4: 提交**

```bash
git add scripts/set-knowledge-weights.ts
git commit -m "feat: add script to set knowledge point weights"
```

---

## Task 2: 清理重复模板

**Files:**
- Create: `scripts/cleanup-duplicate-templates.ts`

- [ ] **Step 1: 创建模板清理脚本**

```typescript
// scripts/cleanup-duplicate-templates.ts
import { prisma } from '../lib/prisma';

async function cleanup() {
  // 找到二次函数知识点 id
  const kp = await prisma.knowledgePoint.findFirst({
    where: { name: '二次函数' },
    select: { id: true }
  });

  if (!kp) {
    console.error('找不到二次函数知识点');
    return;
  }

  // 找到所有 quadratic_vertex 模板
  const templates = await prisma.template.findMany({
    where: { templateKey: 'quadratic_vertex' },
    select: { id: true, knowledgeId: true, name: true }
  });

  console.log(`找到 ${templates.length} 个 quadratic_vertex 模板`);

  // 保留第一个有 knowledgeId 的模板，删除其他
  const keepId = templates.find(t => t.knowledgeId === kp.id)?.id || templates[0].id;
  const deleteIds = templates.filter(t => t.id !== keepId).map(t => t.id);

  console.log(`保留: ${keepId.slice(0, 12)}...`);
  console.log(`删除: ${deleteIds.length} 个`);

  // 删除重复模板
  for (const id of deleteIds) {
    await prisma.template.delete({ where: { id } });
    console.log(`✓ 删除 ${id.slice(0, 12)}...`);
  }

  // 确保保留的模板有 knowledgeId
  const keepTemplate = await prisma.template.findUnique({
    where: { id: keepId },
    select: { knowledgeId: true }
  });

  if (!keepTemplate?.knowledgeId) {
    await prisma.template.update({
      where: { id: keepId },
      data: { knowledgeId: kp.id }
    });
    console.log(`✓ 更新模板 knowledgeId`);
  }

  await prisma.$disconnect();
}

cleanup().catch(console.error);
```

- [ ] **Step 2: 运行清理脚本**

Run: `npx tsx scripts/cleanup-duplicate-templates.ts`
Expected: 输出保留和删除的模板 ID

- [ ] **Step 3: 验证结果**

Run: `npx tsx -e "import{prisma}from'./lib/prisma';prisma.template.count({where:{templateKey:'quadratic_vertex'}}).then(c=>{console.log('剩余模板数:',c);process.exit(0)});"`
Expected: 剩余模板数为 1

- [ ] **Step 4: 提交**

```bash
git add scripts/cleanup-duplicate-templates.ts
git commit -m "feat: add script to cleanup duplicate templates"
```

---

## Task 3: 修复无 knowledgeId 的模板

**Files:**
- Create: `scripts/fix-orphaned-templates.ts`

- [ ] **Step 1: 创建修复脚本**

```typescript
// scripts/fix-orphaned-templates.ts
import { prisma } from '../lib/prisma';

async function fix() {
  // 找到所有没有 knowledgeId 的模板
  const templates = await prisma.template.findMany({
    where: { knowledgeId: null },
    select: { id: true, name: true, templateKey: true }
  });

  console.log(`找到 ${templates.length} 个无 knowledgeId 的模板`);

  // 获取知识点映射
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true }
  });

  const nameToId = new Map(kps.map(kp => [kp.name, kp.id]));

  // 根据模板名称推断知识点
  const keyToKpName: Record<string, string> = {
    'quadratic_vertex': '二次函数',
    'linear_equation': '一元一次方程',
    'pythagorean': '勾股定理',
    'probability': '概率统计'
  };

  for (const template of templates) {
    const kpName = keyToKpName[template.templateKey || ''] || template.name.includes('二次') ? '二次函数' :
                   template.name.includes('一元') ? '一元一次方程' :
                   template.name.includes('勾股') ? '勾股定理' :
                   template.name.includes('概率') ? '概率统计' : '';

    const kpId = kpName ? nameToId.get(kpName) : null;

    if (kpId) {
      await prisma.template.update({
        where: { id: template.id },
        data: { knowledgeId: kpId }
      });
      console.log(`✓ ${template.name} -> ${kpName}`);
    } else {
      console.log(`⚠ 无法推断: ${template.name}`);
    }
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
```

- [ ] **Step 2: 运行修复脚本**

Run: `npx tsx scripts/fix-orphaned-templates.ts`
Expected: 输出每个模板的修复情况

- [ ] **Step 3: 验证无遗漏**

Run: `npx tsx -e "import{prisma}from'./lib/prisma';prisma.template.count({where:{knowledgeId:null}}).then(c=>{console.log('无 knowledgeId 模板数:',c);process.exit(0)});"`
Expected: 无 knowledgeId 模板数为 0

- [ ] **Step 4: 提交**

```bash
git add scripts/fix-orphaned-templates.ts
git commit -m "feat: add script to fix orphaned templates"
```

---

## Task 4: 更新 assessment/start API

**Files:**
- Modify: `app/api/assessment/start/route.ts:119-132`

- [ ] **Step 1: 修改查询条件**

将第 121 行的 `knowledgePoints: { contains: kp.name }` 改为 `knowledgePoints: { contains: kp.id }`

```typescript
const existingQuestions = await prisma.question.findMany({
  where: {
    knowledgePoints: { contains: kp.id },  // 改这里
    difficulty: {
      gte: queryDifficulty,
      lte: retry ? queryDifficulty + 1 : maxDifficulty,
    },
  },
  // ... rest
});
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run build`
Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add app/api/assessment/start/route.ts
git commit -m "fix: use knowledge point id in assessment/start API"
```

---

## Task 5: 更新 practice/recommend API

**Files:**
- Modify: `app/api/practice/recommend/route.ts:79-85`

- [ ] **Step 1: 修改查询条件**

确保使用 `knowledgePointId` 而不是旧的 `id` 字段

```typescript
const kpId = weakestKnowledge.knowledgePointId;  // 使用正确的字段
const questions = await prisma.question.findMany({
  where: {
    knowledgePoints: { contains: kpId },
  },
  take: 3,
});
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run build`
Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add app/api/practice/recommend/route.ts
git commit -m "fix: use knowledge point id in practice/recommend API"
```

---

## Task 6: 简化 practice/finish API

**Files:**
- Modify: `app/api/practice/finish/route.ts:60-70`

- [ ] **Step 1: 移除 name→id 映射**

由于 Question.knowledgePoints 已经是 id，直接使用即可

```typescript
// 更新每个知识点的掌握度
for (const kpId of knowledgeStats.keys()) {
  // 直接使用 kpId，不需要映射
  const recentAttempts = await prisma.attempt.findMany({
    where: {
      userId: session.user.id,
      completedAt: { not: null },
    },
    include: {
      steps: {
        include: {
          questionStep: {
            include: {
              question: true,
            },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: 50,
  });

  // 统计该知识点的最近表现
  let totalCorrect = 0;
  let totalSteps = 0;
  for (const a of recentAttempts) {
    for (const s of a.steps) {
      const kps = s.questionStep?.question?.knowledgePoints;
      if (kps) {
        try {
          const points = JSON.parse(kps);
          if (points.includes(kpId)) {
            totalSteps++;
            if (s.isCorrect) totalCorrect++;
          }
        } catch (e) {}
      }
    }
  }

  if (totalSteps > 0) {
    const mastery = totalCorrect / totalSteps;
    // ... rest of the logic
  }
}
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run build`
Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add app/api/practice/finish/route.ts
git commit -m "refactor: simplify practice/finish by removing name-to-id mapping"
```

---

## Task 7: 创建权重管理 API

**Files:**
- Create: `app/api/user/knowledge-weight/route.ts`

- [ ] **Step 1: 创建权重管理 API**

```typescript
// app/api/user/knowledge-weight/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/user/knowledge-weight - 更新知识点权重
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { knowledgePointId, weight } = await req.json();

    // 验证权重范围
    if (weight < 1 || weight > 5) {
      return NextResponse.json({ error: '权重必须在 1-5 之间' }, { status: 400 });
    }

    // 更新权重
    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { weight }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新权重错误:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// GET /api/user/knowledge-weight - 获取知识点权重
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const kps = await prisma.knowledgePoint.findMany({
      where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
      select: { id: true, name: true, weight: true }
    });

    return NextResponse.json({ success: true, data: kps });
  } catch (error) {
    console.error('获取权重错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 验证类型检查**

Run: `npm run build`
Expected: 无 TypeScript 错误

- [ ] **Step 3: 提交**

```bash
git add app/api/user/knowledge-weight/route.ts
git commit -m "feat: add knowledge point weight management API"
```

---

## Task 8: 添加权重管理界面

**Files:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 在设置摘要中添加权重显示**

在知识点数量显示区域添加权重调整控件：

```typescript
// 在 LearningSettings 组件中添加权重状态
const [weights, setWeights] = useState<Record<string, number>>({});

// 加载权重
useEffect(() => {
  const loadWeights = async () => {
    const res = await fetch('/api/user/knowledge-weight');
    if (res.ok) {
      const data = await res.json();
      const weightMap = Object.fromEntries(
        data.data.map((kp: { id: string; name: string; weight: number }) => [kp.id, kp.weight])
      );
      setWeights(weightMap);
    }
  };
  loadWeights();
}, []);

// 权重更新处理
const handleWeightChange = async (kpId: string, weight: number) => {
  setWeights(prev => ({ ...prev, [kpId]: weight }));
  try {
    await fetch('/api/user/knowledge-weight', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledgePointId: kpId, weight })
    });
  } catch (error) {
    console.error('更新权重失败:', error);
  }
};
```

- [ ] **Step 2: 在 KnowledgeTreeView 中显示权重**

修改知识点树显示，添加权重滑块：

```typescript
// 在知识点项中添加权重控制
{chapter.knowledgePoints?.map(kp => (
  <div key={kp.id} className="flex items-center gap-2">
    <span className="flex-1">{kp.name}</span>
    <input
      type="range"
      min="1"
      max="5"
      value={weights[kp.id] || kp.weight || 1}
      onChange={(e) => handleWeightChange(kp.id, parseInt(e.target.value))}
      className="w-20"
    />
    <span className="text-sm text-on-surface-variant">
      {weights[kp.id] || kp.weight || 1}
    </span>
  </div>
))}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: 无 TypeScript 错误

- [ ] **Step 4: 提交**

```bash
git add components/LearningSettings.tsx
git commit -m "feat: add weight management UI in learning settings"
```

---

## Task 9: 创建数据验证脚本

**Files:**
- Create: `scripts/validate-data-flow.ts`

- [ ] **Step 1: 创建验证脚本**

```typescript
// scripts/validate-data-flow.ts
import { prisma } from '../lib/prisma';

async function validate() {
  console.log('=== 数据流验证 ===\n');

  // 1. 检查知识点
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true, weight: true, inAssess: true }
  });

  console.log('知识点状态:');
  kps.forEach(kp => {
    console.log(`  ${kp.name}: weight=${kp.weight}, inAssess=${kp.inAssess}`);
  });

  // 2. 检查模板
  const templates = await prisma.template.findMany({
    select: { id: true, name: true, knowledgeId: true }
  });

  const noKpTemplates = templates.filter(t => !t.knowledgeId);
  console.log(`\n模板状态: 总数 ${templates.length}, 无 knowledgeId: ${noKpTemplates.length}`);

  // 3. 检查题目
  const questions = await prisma.question.findMany({
    select: { knowledgePoints: true },
    take: 10
  });

  let idCount = 0;
  questions.forEach(q => {
    const kps = JSON.parse(q.knowledgePoints || '[]');
    if (kps[0]?.length > 20) idCount++;
  });

  console.log(`\n题目状态: 抽样 ${questions.length} 个, 使用 id: ${idCount}`);

  // 4. 总结
  const allValid = kps.every(kp => kp.weight > 0) &&
                   noKpTemplates.length === 0 &&
                   idCount === questions.length;

  console.log(`\n${allValid ? '✓ 验证通过' : '✗ 验证失败'}`);

  await prisma.$disconnect();
}

validate().catch(console.error);
```

- [ ] **Step 2: 运行验证**

Run: `npx tsx scripts/validate-data-flow.ts`
Expected: 输出显示"验证通过"

- [ ] **Step 3: 提交**

```bash
git add scripts/validate-data-flow.ts
git commit -m "feat: add data flow validation script"
```

---

## Task 10: 端到端测试

**Files:**
- None (manual testing)

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 手动测试流程**

1. 打开浏览器访问 `http://localhost:3000`
2. 登录测试账号
3. 进入"我的" → "学习设置"
4. 确认四个知识点都显示
5. 调整权重滑块，确认保存成功
6. 进入"测评"，开始测评
7. 完成测评，确认结果正确
8. 进入"练习"，确认推荐题目基于权重

- [ ] **Step 3: 检查控制台错误**

确认无 console 错误或警告

- [ ] **Step 4: 提交（如需要修复）**

如发现问题，修复后提交

---

## 验证清单

完成所有任务后，验证：

- [ ] 四个知识点 weight > 0
- [ ] 所有 Templates 都有 knowledgeId
- [ ] Question.knowledgePoints 使用 id 格式
- [ ] assessment/start 使用 id 查询
- [ ] practice/recommend 使用 id 查询
- [ ] practice/finish 直接使用 id
- [ ] 权重管理界面可用
- [ ] 数据验证脚本通过
