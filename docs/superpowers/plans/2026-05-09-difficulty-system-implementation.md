# 诊断测评难度体系重新设计 - 实施计划

**日期**: 2026-05-09
**设计文档**: `docs/superpowers/specs/2026-05-09-difficulty-system-redesign.md`
**状态**: 待审核

---

## 实施概览

| 步骤 | 任务 | 验收门禁 |
|------|------|----------|
| 1.1 | 修改 assessment/start/route.ts 取题逻辑 | `pnpm build` 成功 |
| 1.2 | 删除废弃的 assessment-utils.ts | 无编译错误 |
| 1.3 | 删除 KP.difficultyLevel 字段 | `prisma generate` 成功 |
| 1.4 | 运行 E2E 测试 | 12/12 测试通过 |
| 1.5 | API 验证 | 返回10题，难度4-6 |

---

## 详细实施步骤

### Step 1: 修改 assessment/start/route.ts

#### 1.1 删除废弃 import

**文件**: `app/api/assessment/start/route.ts`

**操作**:
- 删除第4行的 import

**验收门禁**:
```bash
grep -n "assessment-utils" app/api/assessment/start/route.ts
# 期望：无输出
```

#### 1.2 替换难度计算逻辑（第86-101行）

**当前代码**:
```typescript
let startDifficulty: number;
if (requestedDifficulty !== null) {
  startDifficulty = Math.max(1, Math.min(12, requestedDifficulty));
} else if (retry) {
  startDifficulty = getAssessmentStartLevel(userGrade, targetScore);
  if ((user.initialAssessmentScore ?? 0) >= 90) {
    startDifficulty = Math.min(startDifficulty + 2, 10);
  }
} else {
  startDifficulty = getAssessmentStartLevel(userGrade, targetScore);
}
const { min: minDifficulty, max: maxDifficulty } = getGradeDifficultyRange(userGrade);
```

**修改为**:
```typescript
// 首次测评：固定难度范围 4-6
// retry 模式：使用传入的难度参数
const targetDifficulty = requestedDifficulty ?? 5; // 默认中等难度
```

**验收门禁**:
```bash
pnpm build
# 期望：exit code 0
```

#### 1.3 替换取题难度过滤逻辑（第161-170行）

**当前代码**:
```typescript
const queryDifficulty = retry ? startDifficulty : minDifficulty;
const question = await prisma.question.findFirst({
  where: {
    knowledgePoints: { contains: kp.id },
    id: { notIn: Array.from(usedQuestionIds) },
    difficulty: {
      gte: queryDifficulty,
      lte: retry ? queryDifficulty + 1 : maxDifficulty,
    },
  },
  // ...
});
```

**修改为**:
```typescript
// 首次测评：难度范围 4-6
// retry 模式：难度范围 [difficulty-1, difficulty+1]
const minDiff = retry ? Math.max(1, targetDifficulty - 1) : 4;
const maxDiff = retry ? Math.min(12, targetDifficulty + 1) : 6;

const question = await prisma.question.findFirst({
  where: {
    knowledgePoints: { contains: kp.id },
    id: { notIn: Array.from(usedQuestionIds) },
    difficulty: {
      gte: minDiff,
      lte: maxDiff,
    },
  },
  // ...
});
```

**验收门禁**:
1. `pnpm build` → 期望：exit code 0
2. API 调用验证（见 Step 1.5）

---

### Step 2: 删除废弃代码

#### 2.1 删除 assessment-utils.ts

**操作**: 删除整个文件 `lib/assessment-utils.ts`

**验收门禁**:
```bash
grep -rn "assessment-utils" app/
# 期望：无输出

pnpm build
# 期望：exit code 0
```

#### 2.2 删除 KP.difficultyLevel 字段

**文件**: `prisma/schema.prisma`

**操作**: 删除以下行：
```prisma
difficultyLevel        Int?           @default(6)
```

**验收门禁**:
```bash
grep "difficultyLevel" prisma/schema.prisma
# 期望：无 KP 相关行

npx prisma generate
# 期望：exit code 0
```

---

### Step 3: 验证测试

#### 3.1 数据库题目数量验证

**命令**:
```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.question.count({
    where: { difficulty: { gte: 4, lte: 6 } }
  });
  console.log('难度4-6题目数量:', count);
  process.exit(count >= 10 ? 0 : 1);
}

main().finally(() => prisma.\$disconnect());
"
```

**验收门禁**: 难度 4-6 的题目数量 >= 10

#### 3.2 运行 E2E 测试

**命令**:
```bash
npx playwright test e2e/diagnostic-adaptive-flow.spec.ts
```

**验收门禁**: 12/12 测试全部通过

#### 3.3 API 手动验证

**前提**: 开发服务器运行中 (`pnpm dev`)

**命令**:
```bash
curl -X POST http://localhost:3000/api/assessment/start \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=<YOUR_TOKEN>" | \
  jq '.data.questions | map(.difficulty) | {difficulties: ., allInRange: (map(select(. < 4 or . > 6) | length) == 0}'
```

**验收门禁**:
1. API 返回 HTTP 200
2. 返回 10 道题目
3. 所有题目难度在 4-6 范围内 (`allInRange: true`)

---

## 风险缓解

| 风险 | 缓解措施 | 验证 |
|------|----------|------|
| 删除 assessment-utils.ts 后其他代码报错 | 确认只有 assessment/start 使用 | `grep -rn "assessment-utils" app/` 无结果 |
| 删除 KP.difficultyLevel 后 Prisma 查询报错 | 确认无 Prisma 查询使用此字段 | `grep -rn "KP\.difficultyLevel\|kp\.difficultyLevel"` |
| 首次测评取不到足够题目 | 验证数据库中难度 4-6 的题目数量 | Step 3.1 验证 >= 10 |

---

## 回滚计划

如出现问题，执行以下回滚：

```bash
# 回滚代码修改
git checkout HEAD -- app/api/assessment/start/route.ts

# 回滚 schema 修改
git checkout HEAD -- prisma/schema.prisma
npx prisma generate

# 恢复 assessment-utils.ts
git checkout HEAD -- lib/assessment-utils.ts

# 验证回滚成功
pnpm build
```
