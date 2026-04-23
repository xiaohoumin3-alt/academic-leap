# 起始分重新校准功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户提供剔除试玩数据的救济渠道，让进步曲线真实反映产品帮助价值

**Architecture:**
- 后端：扩展 analytics API 返回校准状态，新增校准接口
- 前端：新增校准卡片组件，集成到分析页
- 数据库：User 表新增两个字段存储校准状态

**Tech Stack:** Next.js, Prisma, SQLite, React, TypeScript

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `prisma/schema.prisma` | 数据模型：新增校准相关字段 |
| `app/api/analytics/overview/route.ts` | 扩展：返回校准状态和预览数据 |
| `app/api/analytics/recalibrate/route.ts` | 新建：执行校准的 API |
| `components/StartingScoreCalibrationCard.tsx` | 新建：校准提示卡片组件 |
| `components/AnalyzePage.tsx` | 修改：集成校准卡片 |

---

### Task 1: 数据库迁移 - 添加校准字段

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加 User 模型新字段**

在 `User` 模型中添加两个新字段：

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  grade         Int?
  // ... 现有字段

  // 新增：起始分校准相关字段
  startingScoreCalibrated   Boolean  @default(false)
  calibratedStartingScore   Int?
}
```

- [ ] **Step 2: 推送数据库变更**

运行命令：
```bash
npx prisma db push
```

预期输出：
```
✔ The database is now in sync with the Prisma schema.
```

- [ ] **Step 3: 提交变更**

```bash
git add prisma/schema.prisma
git commit -m "feat: add starting score calibration fields to User model"
```

---

### Task 2: API - 扩展 analytics/overview 返回校准状态

**Files:**
- Modify: `app/api/analytics/overview/route.ts`

- [ ] **Step 1: 添加校准检测逻辑**

在 `return NextResponse.json` 之前，添加校准检测：

```typescript
// 检测是否需要校准
let needsCalibration = false;
let calibratedStartingScore = null;

// 条件：最低分 < 平均分 - 50，且记录数 >= 5
if (totalAttempts >= 5 && lowestScore < averageScore - 50) {
  needsCalibration = !user?.startingScoreCalibrated;

  // 计算校准后的起始分（去掉最低分后的最小值）
  if (needsCalibration) {
    const scoresWithoutLowest = allScores.filter((s: number) => s !== lowestScore);
    calibratedStartingScore = scoresWithoutLowest.length > 0
      ? Math.min(...scoresWithoutLowest)
      : lowestScore;
  }
}

// 如果已校准，使用存储的值
if (user?.startingScoreCalibrated && user?.calibratedStartingScore) {
  calibratedStartingScore = user.calibratedStartingScore;
}
```

- [ ] **Step 2: 扩展返回数据结构**

修改 `overview` 对象，添加新字段：

```typescript
return NextResponse.json({
  overview: {
    totalAttempts,
    completedAttempts,
    averageScore: Math.round(averageScore),
    lowestScore: Math.round(lowestScore),
    totalMinutes,
    completionRate: totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0,
    dataReliability,
    volatilityRange,
    initialAssessmentCompleted: user?.initialAssessmentCompleted ?? false,
    initialAssessmentScore: user?.initialAssessmentScore ?? 0,
    // 新增字段
    needsCalibration,
    calibratedStartingScore,
    startingScoreCalibrated: user?.startingScoreCalibrated ?? false,
  },
  // ... 其余字段
});
```

- [ ] **Step 3: 验证 API 响应**

访问 `http://localhost:3000/api/analytics/overview`，检查返回是否包含新字段：
- `needsCalibration`
- `calibratedStartingScore`
- `startingScoreCalibrated`

- [ ] **Step 4: 提交变更**

```bash
git add app/api/analytics/overview/route.ts
git commit -m "feat: add calibration status to analytics overview API"
```

---

### Task 3: API - 创建校准执行接口

**Files:**
- Create: `app/api/analytics/recalibrate/route.ts`

- [ ] **Step 1: 创建校准 API 文件**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/analytics/recalibrate - 执行起始分校准
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取所有有效成绩
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 },
      },
      select: { score: true },
      orderBy: { completedAt: 'asc' },
    });

    if (attempts.length < 5) {
      return NextResponse.json({ error: '练习记录不足，无法校准' }, { status: 400 });
    }

    const allScores = attempts.map((a) => a.score);
    const oldStartingScore = Math.min(...allScores);

    // 计算新起始分：去掉最低分后的最小值
    const scoresWithoutLowest = allScores.filter((s) => s !== oldStartingScore);
    const newStartingScore = Math.min(...scoresWithoutLowest);

    // 更新用户校准状态
    await prisma.user.update({
      where: { id: userId },
      data: {
        startingScoreCalibrated: true,
        calibratedStartingScore: newStartingScore,
      },
    });

    return NextResponse.json({
      success: true,
      newStartingScore,
      oldStartingScore,
    });
  } catch (error) {
    console.error('校准起始分错误:', error);
    return NextResponse.json({ error: '校准失败' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试 API**

运行命令：
```bash
curl -X POST http://localhost:3000/api/analytics/recalibrate \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>"
```

预期响应：
```json
{
  "success": true,
  "newStartingScore": 85,
  "oldStartingScore": 10
}
```

- [ ] **Step 3: 提交变更**

```bash
git add app/api/analytics/recalibrate/route.ts
git commit -m "feat: add starting score recalibration API"
```

---

### Task 4: 前端 - 创建校准卡片组件

**Files:**
- Create: `components/StartingScoreCalibrationCard.tsx`

- [ ] **Step 1: 创建校准卡片组件**

```typescript
import React, { useState } from 'react';
import { motion } from 'motion/react';
import MaterialIcon from './MaterialIcon';

interface CalibrationCardProps {
  originalLowestScore: number;
  newStartingScore: number;
  currentScore: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

export const StartingScoreCalibrationCard: React.FC<CalibrationCardProps> = ({
  originalLowestScore,
  newStartingScore,
  currentScore,
  onConfirm,
  onDismiss,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const oldProgress = currentScore - originalLowestScore;
  const newProgress = currentScore - newStartingScore;

  const handleConfirm = async () => {
    setIsCalibrating(true);
    try {
      await onConfirm();
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-warning-container/10 border border-warning-container/30 rounded-2xl p-5 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-warning-container text-on-warning-container">
          <MaterialIcon icon="lightbulb" style={{ fontSize: '20px' }} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-on-surface mb-1">检测到可能的试玩数据</h4>
          <p className="text-sm text-on-surface-variant mb-3">
            您的历史最低分（{originalLowestScore}分）与当前水平差异较大，可能是试用时的数据。
          </p>

          {showPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-surface rounded-xl p-4 mb-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">校准后起始分</span>
                <span className="font-bold text-primary">{newStartingScore}分</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-on-surface-variant">进步幅度变化</span>
                <span className="font-medium">
                  <span className="line-through text-on-surface-variant/50">+{oldProgress}分</span>
                  <span className="ml-2 text-success">+{newProgress}分</span>
                </span>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            {!showPreview ? (
              <>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex-1 py-2 px-4 bg-surface-container text-on-surface rounded-full text-sm font-medium"
                >
                  预览详情
                </button>
                <button
                  onClick={onDismiss}
                  className="flex-1 py-2 px-4 bg-outline/10 text-on-surface rounded-full text-sm font-medium"
                >
                  保持现状
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-2 px-4 bg-surface-container text-on-surface rounded-full text-sm font-medium"
                >
                  返回
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isCalibrating}
                  className="flex-1 py-2 px-4 bg-primary text-on-primary rounded-full text-sm font-medium disabled:opacity-50"
                >
                  {isCalibrating ? '校准中...' : '确认校准'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 2: 提交变更**

```bash
git add components/StartingScoreCalibrationCard.tsx
git commit -m "feat: add starting score calibration card component"
```

---

### Task 5: 前端 - 集成校准卡片到分析页

**Files:**
- Modify: `components/AnalyzePage.tsx`

- [ ] **Step 1: 导入组件**

在文件顶部添加导入：

```typescript
import { StartingScoreCalibrationCard } from './StartingScoreCalibrationCard';
```

- [ ] **Step 2: 添加校准状态和函数**

在 `AnalyzePage` 组件内，添加状态：

```typescript
const [isCalibrating, setIsCalibrating] = useState(false);
```

添加校准函数：

```typescript
const handleCalibration = async () => {
  try {
    const response = await fetch('/api/analytics/recalibrate', {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      // 重新加载数据
      loadAnalytics();
    }
  } catch (error) {
    console.error('校准失败:', error);
  }
};
```

- [ ] **Step 3: 渲染校准卡片**

在"成绩提升"卡片之前添加条件渲染：

```typescript
{/* 起始分校准提示 */}
{overview?.overview?.needsCalibration && overview?.overview?.calibratedStartingScore && (
  <StartingScoreCalibrationCard
    originalLowestScore={overview.overview.lowestScore}
    newStartingScore={overview.overview.calibratedStartingScore}
    currentScore={currentScore}
    onConfirm={handleCalibration}
    onDismiss={() => {
      // 用户选择保持现状，不再提示（可选：记录到本地存储）
    }}
  />
)}
```

- [ ] **Step 4: 调整起始分显示逻辑**

修改起始分计算，使用校准后的值：

```typescript
const startScore = overview?.overview?.startingScoreCalibrated && overview?.overview?.calibratedStartingScore
  ? overview.overview.calibratedStartingScore
  : overview?.overview?.lowestScore ?? currentScore;
```

- [ ] **Step 5: 提交变更**

```bash
git add components/AnalyzePage.tsx
git commit -m "feat: integrate calibration card into analyze page"
```

---

### Task 6: 类型定义更新

**Files:**
- Modify: `components/AnalyzePage.tsx` (更新接口定义)

- [ ] **Step 1: 更新 Overview 接口**

```typescript
interface OverviewData {
  overview: {
    totalAttempts: number;
    completedAttempts: number;
    averageScore: number;
    lowestScore: number;
    totalMinutes: number;
    completionRate: number;
    dataReliability: 'high' | 'medium' | 'low';
    volatilityRange: number;
    initialAssessmentCompleted: boolean;
    initialAssessmentScore: number;
    // 新增字段
    needsCalibration: boolean;
    calibratedStartingScore: number | null;
    startingScoreCalibrated: boolean;
  };
  // ... 其余字段
}
```

- [ ] **Step 2: 提交变更**

```bash
git add components/AnalyzePage.tsx
git commit -m "fix: update type definitions for calibration feature"
```

---

## 验收测试

- [ ] **测试场景 1：正常触发校准**
  - 创建测试数据：5+ 条记录，最低分 10，平均分 90+
  - 访问分析页，应显示校准提示卡片
  - 点击"预览详情"，显示新起始分
  - 点击"确认校准"，起始分更新

- [ ] **测试场景 2：边界条件**
  - 记录数 < 5：不显示校准提示
  - 最低分与平均分差异 < 50：不显示校准提示
  - 已校准用户：不再显示校准提示

- [ ] **测试场景 3：UI 交互**
  - 点击"保持现状"，卡片消失（不再提示）
  - 校准后刷新页面，起始分使用新值
  - 进步幅度显示正确

---

## 完成标准

- [ ] 所有 API 测试通过
- [ ] 所有组件渲染正常
- [ ] 类型检查无错误：`npx tsc --noEmit`
- [ ] 功能测试通过所有场景
