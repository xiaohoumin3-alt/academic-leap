# 用户年级字段统一实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 统一用户年级字段，移除冗余的selectedGrade，用户卡片和学习设置使用同一数据源

**架构:** 数据迁移将现有selectedGrade数据合并到grade字段，API统一使用grade字段，前端组件从学习设置API读取显示

**技术栈:** Prisma, TypeScript, Next.js, SQLite

---

### Task 1: 创建数据迁移脚本

**文件:**
- Create: `prisma/migrations/20260424_merge_selected_grade/migration.sql`

- [ ] **Step 1: 创建迁移目录**

```bash
mkdir -p prisma/migrations/20260424_merge_selected_grade
```

- [ ] **Step 2: 创建迁移SQL文件**

创建 `prisma/migrations/20260424_merge_selected_grade/migration.sql`:

```sql
-- Migration: Merge selectedGrade into grade
-- Date: 2024-04-24

-- Step 1: 将 selectedGrade 的值合并到 grade (如果 selectedGrade 存在且 grade 为默认值)
UPDATE User 
SET grade = selectedGrade 
WHERE selectedGrade IS NOT NULL 
  AND (grade IS NULL OR grade = 0);

-- Step 2: 备份 selectedGrade 数据到日志（可选，用于审计）
-- 此步骤在开发环境可跳过

-- Step 3: 验证数据完整性
-- 确保所有用户都有有效的 grade 值
```

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260424_merge_selected_grade/
git commit -m "migration: create SQL migration to merge selectedGrade into grade"
```

---

### Task 2: 更新 Prisma Schema

**文件:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 移除 selectedGrade 字段**

找到 User 模型中的 `selectedGrade Int?` 行（约第35行），删除该行：

```prisma
// 删除这一行:
selectedGrade      Int?      // 选择的年级 (7-12)
```

- [ ] **Step 2: 保留其他字段**

确保以下字段保持不变：
```prisma
grade       Int       // 年级: 1-12
selectedSubject    String?   // 选择的科目 (数学)
selectedTextbookId String?   // 选择的教材版本ID
```

- [ ] **Step 3: 生成 Prisma 迁移**

```bash
npx prisma migrate dev --name remove_selectedGrade
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "refactor: remove redundant selectedGrade field from User model"
```

---

### Task 3: 更新 Settings API

**文件:**
- Modify: `app/api/user/settings/route.ts`

- [ ] **Step 1: 更新 GET 方法中的字段引用**

找到返回数据部分，将 `selectedGrade` 改为 `grade`：

```typescript
return NextResponse.json({
  success: true,
  data: {
    grade: user.grade,  // 改为 grade
    selectedSubject: user.selectedSubject,
    selectedTextbookId: user.selectedTextbookId,
    selectedTextbook,
    studyProgress: user.studyProgress ?? 0,
  }
});
```

- [ ] **Step 2: 更新 PUT 方法中的字段引用**

找到更新数据的部分（约第147-153行），将 `selectedGrade` 改为 `grade`：

```typescript
const { grade, selectedSubject, selectedTextbookId, studyProgress } = body as SettingsUpdateBody;
```

- [ ] **Step 3: 更新验证函数**

找到 `validateSettingsUpdate` 函数，将 `selectedGrade` 改为 `grade`：

```typescript
interface SettingsUpdateBody {
  grade?: number;  // 改为 grade
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
}

function validateSettingsUpdate(body: unknown): body is SettingsUpdateBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { grade, selectedSubject, selectedTextbookId, studyProgress } = body as Record<string, unknown>;

  // Validate grade if provided
  if (grade !== undefined) {
    if (typeof grade !== 'number' || grade < 1 || grade > 12) {
      return false;
    }
  }
  // ... 其他验证保持不变
```

- [ ] **Step 4: 更新数据库更新逻辑**

找到 `prisma.user.update` 调用（约第203-210行）：

```typescript
user = await prisma.user.update({
  where: { id: session.user.id },
  data: {
    ...(grade !== undefined && { grade }),  // 改为 grade
    ...(selectedSubject !== undefined && { selectedSubject }),
    ...(selectedTextbookId !== undefined && { selectedTextbookId }),
    ...(studyProgress !== undefined && { studyProgress }),
  },
  // ...
});
```

- [ ] **Step 5: 同样更新 create 逻辑**

如果代码中有 `prisma.user.create` 部分，同样将 `selectedGrade` 改为 `grade`

- [ ] **Step 6: Commit**

```bash
git add app/api/user/settings/route.ts
git commit -m "refactor: use grade field instead of selectedGrade in settings API"
```

---

### Task 4: 更新 LearningSettings 组件

**文件:**
- Modify: `components/LearningSettings.tsx`

- [ ] **Step 1: 更新类型定义**

如果有 `selectedGrade` 相关的类型，更新为 `grade`

- [ ] **Step 2: 更新 API 调用中的字段引用**

找到所有 `selectedGrade` 的引用，改为 `grade`：

```typescript
// 显示时
{settings.grade}年级 · {settings.selectedSubject}

// 保存时
const result = await userApi.updateSettings({
  grade: selectedGrade ?? undefined,  // API字段名改为 grade
  selectedSubject: selectedSubject ?? undefined,
  selectedTextbookId,
});
```

- [ ] **Step 3: Commit**

```bash
git add components/LearningSettings.tsx
git commit -m "refactor: use grade field in LearningSettings component"
```

---

### Task 5: 更新 "我的" 页面

**文件:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: 修改 User 接口定义**

将 `grade` 改为从设置获取：

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  // 移除 grade 字段，将从 settings 获取
}

interface UserSettings {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
}
```

- [ ] **Step 2: 添加 settings 状态**

```typescript
const [settings, setSettings] = useState<UserSettings | null>(null);
```

- [ ] **Step 3: 加载用户设置**

在 `useEffect` 中添加获取设置的逻辑：

```typescript
useEffect(() => {
  Promise.all([
    fetch('/api/auth/session').then(res => res.json()),
    fetch('/api/analytics/overview').then(res => res.json()).catch(() => ({ overview: null })),
    fetch('/api/user/settings').then(res => res.json()).catch(() => ({ data: null }))
  ])
    .then(([sessionData, analyticsData, settingsData]) => {
      if (sessionData && sessionData.user) {
        setUser(sessionData.user);
        if (settingsData.data) {
          setSettings(settingsData.data);
        }
        // ... 其他逻辑
      }
    })
    .catch(console.error)
    .finally(() => setLoading(false));
}, []);
```

- [ ] **Step 4: 更新用户卡片显示**

找到显示年级的部分（约第164-169行）：

```typescript
{settings && (
  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
    <MaterialIcon icon="school" style={{ fontSize: '18px' }} />
    <span>{settings.grade}年级 · {settings.selectedSubject || '未设置'}</span>
  </div>
)}
```

- [ ] **Step 5: 移除旧的 grade 显示**

如果有原来显示 `user.grade` 的代码，删除它

- [ ] **Step 6: Commit**

```bash
git add app/me/page.tsx
git commit -m "refactor: display grade from settings in user profile card"
```

---

### Task 6: 更新其他使用 selectedGrade 的文件

**文件:**
- Modify: (搜索项目中所有使用 selectedGrade 的地方)

- [ ] **Step 1: 搜索所有引用**

```bash
grep -r "selectedGrade" --include="*.ts" --include="*.tsx" .
```

- [ ] **Step 2: 逐个文件更新**

找到的文件可能包括：
- API 类型定义
- 测试文件
- 其他组件

将所有 `selectedGrade` 改为 `grade`

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "refactor: update all remaining selectedGrade references to grade"
```

---

### Task 7: 运行数据库迁移

**文件:**
- Database migration

- [ ] **Step 1: 备份数据库**

```bash
cp prisma/dev.db prisma/dev.db.backup
```

- [ ] **Step 2: 重置并应用迁移**

```bash
npx prisma migrate reset
```

注意：这将清空数据库，开发环境可接受。如需保留数据，手动执行 SQL：

```bash
sqlite3 prisma/dev.db < prisma/migrations/20260424_merge_selected_grade/migration.sql
```

- [ ] **Step 3: 验证数据**

```bash
sqlite3 prisma/dev.db "SELECT id, email, grade, selectedSubject FROM User LIMIT 5;"
```

确认 `grade` 字段有正确的值

- [ ] **Step 4: 重新生成 Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/dev.db prisma/migrations/
git commit -m "migration: apply selectedGrade merge migration"
```

---

### Task 8: 测试和验证

**文件:**
- Manual testing

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试用户卡片显示**

1. 访问 /me 页面
2. 确认显示年级和科目（从学习设置读取）
3. 如果没有设置，确认显示"未设置"

- [ ] **Step 3: 测试学习设置**

1. 点击编辑按钮
2. 选择新的年级/科目
3. 保存
4. 确认用户卡片同步更新

- [ ] **Step 4: 测试 API**

```bash
# 测试获取设置
curl -s http://localhost:3000/api/user/settings

# 测试更新设置
curl -s -X PUT http://localhost:3000/api/user/settings \
  -H "Content-Type: application/json" \
  -d '{"grade": 9, "selectedSubject": "数学"}'
```

- [ ] **Step 5: 检查 TypeScript 编译**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "test: verify grade field unification works correctly"
```

---

## 实施完成检查清单

- [ ] Prisma Schema 移除 selectedGrade 字段
- [ ] 数据迁移完成，现有数据合并到 grade
- [ ] Settings API 使用 grade 字段
- [ ] LearningSettings 组件使用 grade 字段
- [ ] "我的"页面从设置 API 读取显示
- [ ] 所有 selectedGrade 引用已更新
- [ ] 用户卡片和学习设置显示一致
- [ ] TypeScript 编译无错误
