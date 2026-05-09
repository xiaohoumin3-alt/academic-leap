# 诊断测评难度体系重新设计

**日期**: 2026-05-09
**状态**: 设计中
**目标**: 理顺诊断测评的难度逻辑，删除无意义的难度概念

---

## 一、问题背景

### 1.1 当前的混乱

当前系统中存在多个无意义的"难度"概念：

| 概念 | 实现 | 问题 |
|------|------|------|
| `Question.difficulty` | 1-12 | ✅ 正确，题目本身有难度 |
| `KP.difficultyLevel` | 固定值 6 | ❌ 无意义，知识点不是题目 |
| `getGradeDifficultyRange(grade)` | grade 8 → min:2, max:4 | ❌ 无意义，年级和题目难度无关 |

### 1.2 导致的问题

```
年级8 → getGradeDifficultyRange(8) → min:2, max:4
↓ 按难度2-4取题
↓ 但题目的难度分布是 [2,4,6,8...]
↓ 知识点难度=6，题目难度=2/4
↓ 找不到足够题目 → 触发AI生成
↓ AI未配置 → 500错误
```

### 1.3 设计原则

**第一性原理**：只有题目有难度，知识点不需要难度。

---

## 二、正确的难度体系

### 2.1 核心概念

**唯一的难度来源：题目本身（`Question.difficulty` 1-12）**

```
难度等级定义：
1-3  ：基础题
4-6  ：中等题（首次测评目标）
7-9  ：进阶题
10-12：挑战题
```

### 2.2 诊断测评流程

```
┌─────────────────────────────────────────────────────────────┐
│                    诊断测评流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  首次测评                                                     │
│  ├─ 目标难度：4-6（中等，用户无感知）                          │
│  ├─ 取题：按知识点 + 难度4-6过滤                               │
│  └─ 返回10题 → 学生作答 → 得分                                │
│                                                              │
│  测评结果处理                                                  │
│  ├─ 得分 < 50%                                               │
│  │   └─ 下一轮目标难度 = 1-3（降低3级）                        │
│  │                                                            │
│  ├─ 得分 50-89%                                              │
│  │   └─ 进入练习模式（当前难度合适）                            │
│  │                                                            │
│  └─ 得分 ≥ 90%                                               │
│      └─ 下一轮目标难度 = 7-9（提高3级）                         │
│                                                              │
│  后续测评（retry模式）                                         │
│  └─ 重复直到进入练习或达到边界（难度1或12）                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 分数-难度映射

| 测评得分 | 判断 | 下一轮动作 |
|---------|------|-----------|
| < 50% | 远超能力 | 目标难度 → 当前-3 |
| 50-89% | 难度合适 | **进入练习模式** |
| ≥ 90% | 远低能力 | 目标难度 → 当前+3 |

**边界处理**：
- 难度1 还是 <50% → 强制进入练习（已达最低难度）
- 难度12 还是 ≥90% → 强制进入练习（已达最高难度）

---

## 三、需要修改的代码

### 3.1 删除：无意义的难度计算

```typescript
// 删除 lib/assessment-utils.ts
export function getGradeDifficultyRange(grade: number) { ... }  // 删除
export function getAssessmentStartLevel(grade, targetScore) { ... }  // 删除
```

### 3.2 删除：知识点难度字段

```prisma
// 删除 prisma/schema.prisma
model KnowledgePoint {
  difficultyLevel Int? @default(6)  // 删除此字段
}
```

### 3.3 修改：取题逻辑

**当前（错误）**：
```typescript
const { min, max } = getGradeDifficultyRange(userGrade);
const question = await prisma.question.findFirst({
  where: {
    knowledgePoints: { contains: kp.id },
    difficulty: { gte: min, lte: max },  // 按年级难度过滤
  },
});
```

**修改后（正确）**：
```typescript
// 首次测评：难度范围固定为4-6
const targetRange = { min: 4, max: 6 };

// retry模式：使用传入的难度参数
const targetRange = retry
  ? { min: targetDifficulty - 1, max: targetDifficulty + 1 }
  : { min: 4, max: 6 };

const question = await prisma.question.findFirst({
  where: {
    knowledgePoints: { contains: kp.id },
    difficulty: { gte: targetRange.min, lte: targetRange.max },
  },
});
```

### 3.4 新增：难度范围计算函数

```typescript
// lib/difficulty.ts

/**
 * 计算下一轮目标难度范围
 * @param currentDifficulty 当前测评的难度
 * @param score 测评得分 (0-100)
 * @returns 下一轮的难度范围 { min, max }
 */
export function calculateNextDifficultyRange(
  currentDifficulty: number,
  score: number
): { min: number; max: number } {
  // 边界检查
  if (currentDifficulty <= 3 && score < 50) {
    // 已是最低难度，仍无法及格，强制进入练习
    return { min: 0, max: 0 }; // special marker
  }
  if (currentDifficulty >= 10 && score >= 90) {
    // 已是最高难度，仍能及格，强制进入练习
    return { min: 0, max: 0 }; // special marker
  }

  let nextDifficulty: number;
  if (score < 50) {
    nextDifficulty = Math.max(1, currentDifficulty - 3);
  } else if (score < 90) {
    // 进入练习模式
    return { min: 0, max: 0 };
  } else {
    nextDifficulty = Math.min(12, currentDifficulty + 3);
  }

  return {
    min: Math.max(1, nextDifficulty - 1),
    max: Math.min(12, nextDifficulty + 1),
  };
}

/**
 * 检查是否应进入练习模式
 */
export function shouldEnterPractice(
  currentDifficulty: number,
  score: number
): { enter: boolean; reason: string } {
  if (score >= 50 && score < 90) {
    return { enter: true, reason: '难度合适' };
  }
  if (currentDifficulty <= 3 && score < 50) {
    return { enter: true, reason: '已达最低难度' };
  }
  if (currentDifficulty >= 10 && score >= 90) {
    return { enter: true, reason: '已达最高难度' };
  }
  return { enter: false, reason: '' };
}

/**
 * 首次测评的固定难度范围
 */
export const FIRST_ASSESSMENT_RANGE = { min: 4, max: 6 };
```

---

## 四、数据流

### 4.1 首次测评

```
用户点击"开始诊断"
    ↓
API: POST /api/assessment/start
    ↓
读取 selectedTextbookId（如有）
    ↓
获取该教材的测评知识点（最多7个）
    ↓
轮询取题（每知识点每轮1题，难度4-6）
    ↓
如题目不足 → 返回错误（不触发AI生成）
    ↓
返回10题给前端
    ↓
用户作答 → API: POST /api/assessment/finish
    ↓
计算得分 → 判断下一动作
```

### 4.2 retry模式

```
用户点击"重新测评"
    ↓
API: POST /api/assessment/start { retry: true, difficulty: N }
    ↓
计算目标难度范围: [N-1, N+1]
    ↓
轮询取题（每知识点每轮1题，目标难度范围）
    ↓
返回10题给前端
    ↓
用户作答 → API: POST /api/assessment/finish
    ↓
计算得分 → 判断下一动作
```

---

## 五、边界情况处理

### 5.1 题目不足

- 诊断测评必须有预置题目
- 如果按知识点+难度过滤后题目不足，返回错误
- **不触发AI生成**（AI生成仅用于练习模式扩充题库）

### 5.2 难度边界

| 情况 | 处理 |
|------|------|
| 难度1 + 得分<50% | 强制进入练习 |
| 难度12 + 得分≥90% | 强制进入练习 |
| 难度越界 | clamp到1-12范围 |

---

## 六、测试验证

### 6.1 功能测试用例

| 用例 | 输入 | 预期输出 |
|------|------|----------|
| 首次测评 | 无参数 | 返回难度4-6的10题 |
| retry | difficulty=3, score=30 | 返回难度1-4的10题 |
| retry | difficulty=3, score=75 | 进入练习 |
| retry | difficulty=10, score=95 | 进入练习 |
| 边界 | difficulty=1, score=40 | 进入练习 |

### 6.2 数据验证

- 确保难度1-12每个等级都有足够题目
- 确保每个测评知识点在每个难度等级都有题目

---

## 七、实施步骤

1. **删除** `lib/assessment-utils.ts` 中的 `getGradeDifficultyRange` 和 `getAssessmentStartLevel`
2. **删除** `prisma/schema.prisma` 中的 `KnowledgePoint.difficultyLevel`
3. **创建** `lib/difficulty.ts` 新难度计算函数
4. **修改** `app/api/assessment/start/route.ts` 取题逻辑
5. **修改** `app/api/assessment/finish/route.ts` 难度判断逻辑
6. **更新** 相关测试
7. **验证** 手动测试流程
