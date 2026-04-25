# KnowledgePoint 系统修复设计

## 背景

### 当前问题

| 问题 | 描述 |
|------|------|
| 数据重复 | 数据库有6条重复的 "E2E知识点-二次函数" 记录 |
| Schema 设计缺陷 | `UserKnowledge.knowledgePoint` 存的是 name 字符串，不是外键 |
| API 使用 name | 无法正确关联出题、模板等 |

### 根因分析

1. **测试数据污染** - E2E 测试创建了重复的知识点记录
2. **Schema 设计错误** - `UserKnowledge` 表使用 name 而不是 id
3. **API 设计问题** - 代码使用 name 进行关联而不是 id

### 原始知识点（来自 init-admin.ts）

| 名称 | 分类 | 权重 |
|------|------|------|
| 二次函数 | 代数 | 30 |
| 一元一次方程 | 代数 | 25 |
| 勾股定理 | 几何 | 20 |
| 概率统计 | 统计 | 25 |

---

## 修复方案

### Phase 1: 数据清理

**目标：** 删除重复的知识点记录，保留正确的4条

**删除条件：**
- `name LIKE 'E2E知识点-%'`
- 保留第一条，删除后续重复记录

**执行 SQL：**
```sql
-- 先查看有哪些重复记录
SELECT id, name, "chapterId", "conceptId", weight, status
FROM "KnowledgePoint"
WHERE name LIKE 'E2E知识点-%'
ORDER BY name, id;

-- 删除重复记录（保留第一条）
DELETE FROM "KnowledgePoint"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "KnowledgePoint"
  WHERE name LIKE 'E2E知识点-%'
  GROUP BY name
);
```

### Phase 2: Schema 修改

**修改文件：** `prisma/schema.prisma`

**Before:**
```prisma
model UserKnowledge {
  id             String    @id @default(cuid())
  userId         String
  knowledgePoint String    // 存的是 name
  mastery        Float     // 0-1 掌握度
  lastPractice   DateTime  @default(now())
  practiceCount  Int       @default(0)

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, knowledgePoint])
}
```

**After:**
```prisma
model UserKnowledge {
  id               String    @id @default(cuid())
  userId           String
  knowledgePointId String    // 外键，关联 KnowledgePoint.id
  mastery          Float     // 0-1 掌握度
  lastPractice     DateTime  @default(now())
  practiceCount    Int       @default(0)

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  knowledgePoint   KnowledgePoint @relation(fields: [knowledgePointId], references: [id], onDelete: Cascade)

  @@unique([userId, knowledgePointId])
}
```

### Phase 3: 代码更新

需要修改的文件列表：

| 文件 | 修改内容 |
|------|---------|
| `app/api/analytics/knowledge/route.ts` | 使用 `knowledgePointId` 而不是 `knowledgePoint` (已完成) |
| `app/api/analytics/overview/route.ts` | `trainingKnowledgeMastery` 使用 id 聚合（已实现） |
| `lib/question-engine/` | 生成题目时使用 id |
| `components/` | 前端显示使用 name，存储使用 id |

### Phase 4: 数据迁移

**迁移脚本：** `scripts/migrate-knowledge-point-id.ts`

```typescript
// 伪代码
const allUserKnowledge = await prisma.userKnowledge.findMany();

for (const uk of allUserKnowledge) {
  // 通过 name 找到对应的 KnowledgePoint.id
  const kp = await prisma.knowledgePoint.findFirst({
    where: { name: uk.knowledgePoint }
  });

  if (kp) {
    await prisma.userKnowledge.update({
      where: { id: uk.id },
      data: { knowledgePointId: kp.id }
    });
  }
}
```

---

## 验收标准

- [ ] 数据库只保留4条正确的知识点记录
- [ ] `UserKnowledge` 表使用 `knowledgePointId` 外键
- [ ] 所有 API 使用 `id` 而不是 `name` 进行关联
- [ ] 前端正确显示知识点名称
- [ ] 无 TypeScript 错误
- [ ] 无数据丢失

---

## 注意事项

1. **备份数据** - 迁移前先备份数据库
2. **测试数据** - 确保测试也使用正确的 id
3. **一致性** - 确保所有地方使用相同的关联方式