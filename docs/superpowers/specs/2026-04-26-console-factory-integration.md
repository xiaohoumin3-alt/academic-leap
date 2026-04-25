# 后台管理系统重构与模板工厂整合设计

> 渐进式重构：Template 表成为唯一配置源，模板工厂 UI 无缝集成

## 背景

### 问题现状

1. **数据断裂**：Knowledge API 缺少 concept 关联
2. **配置混乱**：TemplateEditor 的 formData 无法持久化到 Template 表
3. **双轨并存**：TEMPLATE_REGISTRY（内存）与 Template 表（数据库）各自为政
4. **UI 缺失**：模板工厂后端已完成，但前端没有对应界面

### 重构目标

1. **Template 表成为唯一配置源** - 所有模板配置持久化到数据库
2. **向后兼容** - 现有 TEMPLATE_REGISTRY 作为 fallback，不影响用户端
3. **充分复用** - 最大化利用现有资产（hooks、API、UI框架）
4. **功能做实** - 数据打通，流程打通，无空架子

## 核心原则

| 原则 | 说明 |
|------|------|
| 向后兼容 | 现有用户端功能零影响 |
| 渐进式重构 | 分 Phase 实施，每个阶段可验证 |
| 数据优先 | 先修数据层，再改 UI |
| 资产复用 | 不重复造轮子 |

## 数据模型优化

### Phase 1: Schema 调整

```prisma
// prisma/schema.prisma

// Template 模型优化
model Template {
  id          String   @id @default(cuid())
  name        String
  type        String
  templateKey String?  // 关联 TEMPLATE_REGISTRY 的 key（如 sqrt_concept）
  structure   Json?    // 渲染配置 { title, description, context }
  params      Json?    // 参数规格 { level: { value: { type, min, max } } }
  steps       Json?    // 步骤配置 [ { stepId, type, ui } ]
  version     Int      @default(1)
  status      String   @default("draft")  // draft | staging | production
  knowledgeId String?
  skeletonIds Json     @default("[]")   // 改为 Json 类型
  source      String   @default("manual")  // manual | yaml_import | ai_generated
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  knowledge   KnowledgeConcept? @relation("TemplateConcept", fields: [knowledgeId], references: [id])
  creator     Admin @relation(fields: [createdBy], references: [id])
  versions    TemplateVersion[]
  qualities   QuestionQuality[]
}

// Question 模型 - templateId 统一存储 Template.id
model Question {
  id              String         @id @default(cuid())
  type            String
  difficulty      Int
  content         String         @default("{}")
  answer          String
  hint            String?
  knowledgePoints String         @default("[]")
  createdBy       String?
  isAI            Boolean        @default(false)
  createdAt       DateTime       @default(now())
  params          String?        @default("{}")
  stepTypes       String?        @default("[]")
  templateId      String?        // 存储 Template.id（非 registry key）
  // 历史遗留：旧数据可能存储 registry key（如 "quadratic_identify"）
  // 生成时通过 templateKey 字段兼容查询
  steps           QuestionStep[]
}

// Skeleton 模型 - 新增字段
model Skeleton {
  id          String   @id
  stepType    String
  name        String
  config      Json     // { inputType, keyboard, validation }
  status      String   @default("pending")  // pending | approved | production
  source      String   // ai_generated | manual
  createdAt   DateTime @default(now())
  approvedBy  String?
}
```

### Phase 2: 数据迁移

```sql
-- prisma/migrations/fix_template_structure.sql

-- 1. skeletonIds 从 String 迁移到 Json
UPDATE Template SET skeletonIds = '[]' WHERE skeletonIds IS NULL;

-- 2. 清理无效的 skeletonIds JSON
UPDATE Template SET skeletonIds = '[]' WHERE
  skeletonIds IS NOT NULL AND
  skeletonIds NOT LIKE '[%';

-- 3. 为已有模板生成 skeletonIds（从 templateKey 推断步类型）
-- 逻辑在 importer.ts 中处理
```

## 数据流重构

### 双轨并行策略

```
┌─────────────────────────────────────────────────────────────┐
│                    题目生成逻辑                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 查询 Template 表（数据库配置）                          │
│     └─→ 如果有 structure/params/steps → 使用数据库配置      │
│                                                             │
│  2. 否则查询 templateKey → TEMPLATE_REGISTRY（fallback）     │
│     └─→ 兼容旧模板，继续从内存读取                          │
│                                                             │
│  3. 生成 Question → 关联 templateId（统一存 Template.id）    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 双轨退出时机

**当前阶段（双轨并行）：**
- 有 Template 表配置（structure/params/steps）→ 用数据库
- 没有配置的 → fallback 到 REGISTRY

**迁移完成后（所有模板都有 structure/params/steps）：**
- REGISTRY fallback 可以移除
- 简化 generateQuestion 逻辑，直接从 Template 表读取
- TEMPLATE_REGISTRY 保留作为开发时的模板参考（文档作用）

### 代码实现

```typescript
// lib/question-engine/index.ts

export async function generateQuestion(
  knowledgePointId: string,
  difficulty: number
): Promise<QuestionData> {
  // Step 1: 查 Template 表
  const dbTemplate = await prisma.template.findFirst({
    where: {
      knowledgeId: await getConceptId(knowledgePointId),
      status: 'production',
      NOT: { structure: null }
    }
  });

  // Step 2: 如果有数据库配置
  if (dbTemplate?.structure && dbTemplate?.params) {
    const template = buildTemplateFromDb(dbTemplate);
    const params = template.generateParams(difficulty);
    return {
      ...template.render(params),
      steps: template.buildSteps(params),
      templateId: dbTemplate.id
    };
  }

  // Step 3: Fallback 到 REGISTRY
  const registryKey = await getTemplateIdByKnowledgePointId(knowledgePointId);
  const template = TEMPLATE_REGISTRY[registryKey];
  if (!template) throw new Error(`No template for ${knowledgePointId}`);

  const params = template.generateParams(difficulty);
  return {
    ...template.render(params),
    steps: template.buildSteps(params),
    templateId: registryKey  // 兼容旧数据，存 registry key
  };
}
```

## API 层修改

### 修复 Knowledge API

```typescript
// app/api/admin/knowledge/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const subject = searchParams.get('subject');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const where: any = {};
  if (subject) where.subject = subject;
  if (status) where.status = status;
  if (search) where.name = { contains: search };

  const [knowledgePoints, total] = await Promise.all([
    prisma.knowledgePoint.findMany({
      where,
      include: { concept: true },  // 修复：添加关联
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.knowledgePoint.count({ where })
  ]);

  return NextResponse.json({ success: true, data: knowledgePoints, total });
}
```

### 修改题目生成 API

```typescript
// app/api/questions/generate/route.ts

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { knowledgePointId, difficulty = 1 } = body;

  // 使用重构后的生成逻辑
  const questionData = await generateQuestion(knowledgePointId, difficulty);

  // 创建 Question 记录，关联 Template
  const question = await prisma.question.create({
    data: {
      type: 'generated',
      difficulty,
      content: JSON.stringify({
        title: questionData.title,
        description: questionData.description,
        context: questionData.context
      }),
      answer: questionData.steps?.[0]?.answer || '',
      knowledgePoints: JSON.stringify([knowledgePointId]),
      params: JSON.stringify(questionData.params),
      stepTypes: JSON.stringify(questionData.steps?.map(s => s.type)),
      templateId: questionData.templateId,
      createdBy: body.userId
    }
  });

  return NextResponse.json({ success: true, data: { question, steps: questionData.steps } });
}
```

## TemplateEditor 改造

### 职责

1. **模板列表** - 从 Template 表读取（不再从 registry）
2. **编辑配置** - formData 保存到 Template 表
3. **预览生成** - 调用新 API 使用数据库配置
4. **骨架关联** - skeletonIds 由 steps 配置自动推断（不在 UI 编辑）

### 保存逻辑

```typescript
// components/TemplateEditor.tsx

/**
 * 从 steps 配置推断 skeletonIds
 * 例如：steps 中有 type: 'COMPUTE_SQRT' → skeletonIds: ['compute_sqrt']
 */
function extractSkeletonIds(steps: Step[]): string[] {
  const skeletonIds = new Set<string>();
  steps.forEach(step => {
    // StepType 枚举转骨架 ID：COMPUTE_SQRT → compute_sqrt
    const skeletonId = step.type.toLowerCase().replace(/_/g, '');
    skeletonIds.add(skeletonId);
  });
  return Array.from(skeletonIds);
}

async function handleSave(formData: TemplateFormData) {
  const { id, name, type, templateKey, structure, params, steps, knowledgeId } = formData;

  // 从 steps 推断 skeletonIds
  const inferredSkeletonIds = extractSkeletonIds(steps);

  await prisma.template.upsert({
    where: { id: id || undefined },
    create: {
      id: id || undefined,
      name,
      type,
      templateKey: templateKey || null,
      structure: structure || null,
      params: params || null,
      steps: steps || [],
      skeletonIds: inferredSkeletonIds,  // 自动推断
      status: 'draft',
      source: 'manual',
      knowledgeId: knowledgeId || null,
      createdBy: adminId
    },
    update: {
      name,
      type,
      templateKey: templateKey || null,
      structure: structure || null,
      params: params || null,
      steps: steps || [],
      skeletonIds: inferredSkeletonIds,  // 自动推断
      version: { increment: 1 }
    }
  });

  // 记录版本
  await prisma.templateVersion.create({
    data: {
      templateId: id,
      version: currentVersion + 1,
      structure,
      params,
      steps,
      createdBy: adminId
    }
  });

  showToast('模板已保存');
}
```

## 模板工厂 UI

### 集成到 ConsolePage

```typescript
// components/ConsolePage.tsx

type Tab = 'dashboard' | 'template' | 'factory' | 'difficulty' | 'data' | 'quality' | 'config';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'editor', 'viewer'] },
  { id: 'template', label: '模板管理', icon: 'edit', roles: ['admin', 'editor'] },  // 重命名
  { id: 'factory', label: '模板工厂', icon: 'factory', roles: ['admin'] },  // 新增
  { id: 'difficulty', label: '难度校准', icon: 'trending_up', roles: ['admin', 'editor'] },
  { id: 'data', label: '知识点管理', icon: 'storage', roles: ['admin', 'editor', 'viewer'] },
  { id: 'quality', label: '质量分析', icon: 'verified_user', roles: ['admin', 'editor', 'viewer'] },
  { id: 'config', label: '分数地图', icon: 'hub', roles: ['admin', 'editor'] },
].filter(item => adminUser && item.roles.includes(adminUser.role));
```

### Factory Tab 子页面

| 子页面 | 路由 | 功能 |
|--------|------|------|
| 素材导入 | `/factory/import` | 上传/粘贴 YAML，解析预览 |
| 骨架管理 | `/factory/skeletons` | 列表、审核、状态切换 |
| 批量导入 | `/factory/batch` | 确认预览，写入数据库 |

### 素材导入界面

> 骨架关联简化：骨架仅用于 AI 生成时推断 stepType，模板编辑器不直接编辑 skeletonIds
> skeletonIds 由 steps 配置自动推断生成

```
┌─────────────────────────────────────────────────────────────┐
│  模板工厂 - 素材导入                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │ 📚 教材     │  │ 📝 题库     │     ← 选择素材类型        │
│  │ 章节+知识点  │  │ 题目+难度   │                           │
│  └─────────────┘  └─────────────┘                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  粘贴 YAML 内容...                                 │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ 预览结果 ─────────────────────────────────────────┐   │
│  │  知识点 (12)  骨架 (5)  模板 (8)                    │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐                         │   │
│  │  │ kp1 │ │ kp2 │ │ kp3 │  ← 可展开查看详情          │   │
│  │  └──────┘ └──────┘ └──────┘                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ 取消 ]  [ 导入 ]                                        │
└─────────────────────────────────────────────────────────────┘
```

### 骨架管理界面

> 骨架只用于显示和审核，不在模板编辑器中编辑
> 骨架由模板工厂 AI 生成后进入审核队列，审核通过后可用于模板

```
┌─────────────────────────────────────────────────────────────┐
│  模板工厂 - 骨架管理                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  状态筛选: [全部] [Pending] [Approved] [Production]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⏳ compute_sqrt     计算二次根式       Pending      │   │
│  │    StepType: COMPUTE_SQRT    使用: 3次    [审核]      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ✅ simplify_sqrt    最简二次根式      Approved     │   │
│  │    StepType: SIMPLIFY_SQRT    使用: 5次    [查看]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 现有资产复用

| 资产 | 复用方式 | 位置 |
|------|---------|------|
| TEMPLATE_REGISTRY | 作为 fallback，不影响现有模板 | lib/question-engine/templates/index.ts |
| useKnowledgePoints | 复用查询逻辑，只需修复 include | lib/hooks/useAdminData.ts |
| useTemplates | 扩展返回字段（structure, params, steps） | lib/hooks/useAdminData.ts |
| ConsolePage 框架 | 只需新增 factory Tab | components/ConsolePage.tsx |
| MaterialIcon | 继续使用 | components/MaterialIcon.tsx |
| Motion/react | 继续使用动画和过渡 | 已有 |
| Prisma hooks | 复用数据操作 | lib/prisma.ts |

## 实施计划

### Phase 1: 数据层修复
- [ ] 修复 Knowledge API 的 concept include
- [ ] 修改 Template.skeletonIds 为 Json 类型
- [ ] 创建数据迁移脚本
- [ ] 验证 API 返回正确数据

### Phase 2: 生成逻辑重构
- [ ] 重构 generateQuestion 函数（双轨并行）
- [ ] 修改 /api/questions/generate 使用数据库配置
- [ ] 保持 REGISTRY 作为 fallback
- [ ] 测试现有用户端功能不受影响

### Phase 3: TemplateEditor 改造
- [ ] 修改保存逻辑到 Template 表
- [ ] 添加 version 记录
- [ ] 从 skeletonIds 推断 stepType
- [ ] 测试保存/读取循环

### Phase 4: 模板工厂 UI
- [ ] 创建 FactoryTab 组件
- [ ] 实现素材导入界面
- [ ] 实现骨架管理界面
- [ ] 实现预览确认流程
- [ ] 连接已有 API

### Phase 5: 数据迁移
- [ ] 导出迁移 SQL
- [ ] 在开发环境测试
- [ ] 在生产环境执行
- [ ] 验证所有模板正常

## 验收标准

- [ ] 用户端题目生成不受影响
- [ ] Template 表成为模板配置的持久化存储
- [ ] 模板工厂 UI 可正常导入素材
- [ ] 骨架审核流程完整
- [ ] TemplateEditor 保存的模板可直接用于题目生成
- [ ] 现有知识管理功能正常

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 迁移脚本失败 | 先在开发环境测试，提供回滚方案 |
| 用户端功能受影响 | Phase 2 使用双轨并行，REGISTRY 作为 fallback |
| TemplateEditor 保存格式错误 | 提供默认值和验证逻辑 |
| Factory UI 与 API 不兼容 | 使用现有 API 规范，不新增约定 |