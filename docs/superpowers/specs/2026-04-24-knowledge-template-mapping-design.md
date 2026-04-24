# 知识点-模板关联系统设计

**日期:** 2026-04-24
**状态:** 草案

---

## 背景

### 当前问题
- `KNOWLEDGE_TO_TEMPLATES` 硬编码只支持4个知识点
- 数据库中的知识点无法匹配到模板
- Fallback 逻辑掩盖了真正的问题

### 目标
建立知识点与模板的动态关联机制，支持管理员配置和批量导入导出

---

## 设计方案

### 1. 数据模型

利用现有 `Template.knowledgeId` 字段：

```prisma
// Template 表已有 knowledgeId 字段
model Template {
  knowledgeId String?  // 关联的 KnowledgePoint.id
  // ... 其他字段
}
```

### 2. 查询逻辑

**优先级：**
1. **直接匹配**：`Template.knowledgeId == knowledgePointId`
2. **概念匹配**：查找该知识点对应 Concept 下所有已配置模板
3. **无匹配**：返回明确错误

**API 修改：** `lib/question-engine/templates/index.ts`

```typescript
export async function getTemplateIdsByKnowledgePointId(
  knowledgePointId: string
): Promise<string[]> {
  // 1. 直接匹配
  const directTemplates = await prisma.template.findMany({
    where: {
      knowledgeId: knowledgePointId,
      status: 'production'
    },
    select: { id: true }
  });
  if (directTemplates.length > 0) {
    return directTemplates.map(t => t.id);
  }

  // 2. 概念匹配：获取该知识点的 conceptId
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { conceptId: true }
  });

  if (kp) {
    // 查找同学期的所有模板
    const conceptTemplates = await prisma.template.findMany({
      where: {
        status: 'production',
        knowledge: {
          conceptId: kp.conceptId
        }
      },
      select: { id: true }
    });
    return conceptTemplates.map(t => t.id);
  }

  // 3. 无匹配
  return [];
}
```

### 3. 生成 API 错误处理

**`POST /api/questions/generate`**

```typescript
// 替换硬编码映射
const templateIds = await getTemplateIdsByKnowledgePointId(knowledgePointId);

if (templateIds.length === 0) {
  return NextResponse.json({
    success: false,
    error: '该知识点暂未配置题目模板，请联系管理员'
  }, { status: 400 });
}
```

### 4. 导入导出

**CSV 格式：**
```csv
template_id,template_name,knowledge_point_id,knowledge_point_name,concept_name
tpl_xxx,二次函数基础,ykp_xxx,二次函数基础-顶点式,二次函数
```

**导出 API:** `GET /api/admin/templates/export`
```typescript
export async function GET() {
  const templates = await prisma.template.findMany({
    where: { status: { not: 'draft' } },
    include: {
      knowledge: {
        include: { concept: true }
      }
    }
  });

  const rows = templates.map(t => ({
    template_id: t.id,
    template_name: t.name,
    knowledge_point_id: t.knowledgeId || '',
    knowledge_point_name: t.knowledge?.name || '',
    concept_name: t.knowledge?.concept?.name || ''
  }));

  // 转为 CSV
  return new CSV response
}
```

**导入 API:** `POST /api/admin/templates/import`
```typescript
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  const csv = await file.text();
  const rows = parseCSV(csv);

  for (const row of rows) {
    if (row.template_id && row.knowledge_point_id) {
      await prisma.template.update({
        where: { id: row.template_id },
        data: { knowledgeId: row.knowledge_point_id }
      });
    }
  }

  return NextResponse.json({ success: true, count: rows.length });
}
```

### 5. 配置入口

**模板详情页 (`/console/templates/[id]`):**
- 添加"关联知识点"区块
- 显示/搜索/选择知识点
- 导出/导入按钮

**知识点详情页 (`/console/knowledge/[id]`):**
- 显示"关联模板"列表
- 跳转配置

---

## 实施文件

1. **核心逻辑**
   - `lib/question-engine/templates/index.ts` - 重构模板查询

2. **API**
   - `app/api/questions/generate/route.ts` - 错误处理
   - `app/api/admin/templates/export/route.ts` - 导出
   - `app/api/admin/templates/import/route.ts` - 导入

3. **前端**
   - `components/admin/TemplateEditor.tsx` - 编辑关联
   - `components/admin/KnowledgePointEditor.tsx` - 显示关联

---

## 验收标准

- [ ] 未配置模板的知识点返回明确错误（不是 fallback）
- [ ] CSV 导出包含完整映射信息
- [ ] CSV 导入正确更新关联
- [ ] 模板详情页可配置关联
- [ ] 知识点详情页可查看关联
