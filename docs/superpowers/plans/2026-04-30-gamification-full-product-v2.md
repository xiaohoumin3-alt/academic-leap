# 游戏化完整产品实施计划 V2（修订版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标**: 完整实现四主题游戏化 + 社交装逼 + 学习核心解耦 + 家长控制

**核心原则**: 游戏化层与学习核心完全解耦，**不影响LE/CS/DFI指标**

**技术栈**: Next.js 15, React 19, Prisma, Framer Motion, Zustand, Redis（排行榜缓存）

---

## 修订说明

### V2 主要变更

| 类别 | V1 问题 | V2 修复 |
|------|---------|---------|
| **架构** | 违反DFI原则 | 游戏化层作为"观察者"，不干扰学习事件链 |
| **暴击** | 影响IRT估计 | 暴击只影响积分，记录在causalContext中排除噪声 |
| **连胜** | 可能激励刷简单题 | 基于LE而非简单答对 |
| **数据库** | QuestionRecord冗余 | 扩展现有AttemptStep |
| **安全** | 无速率限制 | 添加全面的安全措施 |
| **功能** | 缺少家长控制 | 新增家长控制面板 |
| **验证** | 无A/B实验 | 集成现有EffectExperiment框架 |

---

## 架构设计：学习优先

### 核心原则：游戏化作为"观察者层"

```
┌─────────────────────────────────────────────────────────┐
│                    学习核心层（不可侵犯）                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 自适应难度   │  │ IRT能力估计  │  │ RL推荐引擎   │  │
│  │ (保持不变)   │  │ (保持不变)   │  │ (保持不变)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                        ↓                                 │
│              学习事件链 (Attempt → AttemptStep)         │
│                        ↓                                 │
│              因果推断 (hint_effect, learning_effect)    │
│                        ↓                                 │
│                  LE/CS/DFI 计算（保持>0.99）              │
└─────────────────────────────────────────────────────────┘
                           ↓
                    【只读接口】
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   游戏化观察者层（新增）                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 主题引擎     │  │ 连胜追踪     │  │ 排行榜       │  │
│  │ 挑战系统     │  │ 成就系统     │  │ 组队系统     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  原则：                                                │
│  1. 只读取学习事件，不修改                              │
│  2. 游戏化状态存储在独立表                              │
│  3. 暴击/连胜等随机事件记录在causalContext排除噪声      │
└─────────────────────────────────────────────────────────┘
```

---

## 文件结构（修订版）

```
academic-leap/
├── prisma/
│   └── schema.prisma                      # 修改：扩展现有表，新增游戏化表
├── lib/
│   ├── core/                              # 学习核心（保持不变）
│   │   ├── adaptive-difficulty.ts         # 不修改
│   │   ├── rl/                            # 不修改
│   │   └── qie/                           # 不修改
│   ├── gaming/                            # 游戏化观察者层（新增）
│   │   ├── event-listener.ts              # 监听学习事件
│   │   ├── theme-engine.ts                # 主题引擎
│   │   ├── themes/                        # 四主题配置
│   │   ├── streak-tracker.ts              # 连胜追踪（基于LE）
│   │   ├── achievement-system.ts          # 成就系统
│   │   ├── ranking-system.ts              # 排行榜（带缓存）
│   │   ├── challenge-system.ts            # 挑战系统（带安全）
│   │   ├── team-system.ts                 # 组队系统
│   │   ├── critical-hit.ts                # 暴击系统（噪声隔离）
│   │   ├── parent-control.ts              # 家长控制（新增）
│   │   └── experiment-integration.ts      # A/B实验集成（新增）
│   ├── stores/
│   │   └── gaming-store.ts                # 游戏化状态
│   ├── cache/
│   │   └── ranking-cache.ts               # Redis缓存（新增）
│   └── api.ts                             # 修改：添加游戏化API
├── components/
│   ├── gaming/                            # 游戏化UI组件
│   │   ├── theme/
│   │   ├── feedback/
│   │   ├── rankings/
│   │   ├── challenges/
│   │   ├── teams/
│   │   ├── achievements/
│   │   ├── parent/                        # 家长控制面板（新增）
│   │   └── sound/
│   ├── ExercisePage.tsx                   # 修改：集成游戏化（正确方式）
│   └── HomePage.tsx
├── app/api/
│   └── gaming/                             # 游戏化API路由
│       ├── streak/route.ts
│       ├── rankings/route.ts
│       ├── challenges/route.ts
│       ├── teams/route.ts
│       ├── achievements/route.ts
│       ├── parent/                         # 家长控制API（新增）
│       └── experiment/                     # A/B实验API（新增）
└── types/
    └── gaming.ts                           # 游戏化类型定义
```

---

## 数据库设计（修订版）

### Task 1: 扩展现有表 + 新增游戏化表

**修改原则**: 
1. **不破坏**现有学习事件链
2. 扩展现有表添加游戏化字段
3. 新增表与学习核心解耦

```prisma
// prisma/schema.prisma

// ============ 扩展现有表 ============

// 扩展 AttemptStep - 添加游戏化相关字段
model AttemptStep {
  id             String        @id @default(cuid())
  attemptId      String
  questionStepId String?
  stepNumber     Int
  userAnswer     String
  isCorrect      Boolean
  duration       Int
  submittedAt    DateTime     @default(now())
  questionStep   QuestionStep? @relation(fields: [questionStepId], references: [id], onDelete: Cascade)
  attempt        Attempt       @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  
  // ✅ 新增：游戏化字段（不影响学习核心）
  isRecommended     Boolean   @default(true)   // 是否为AI推荐题
  isCriticalHit     Boolean   @default(false)   // 是否暴击
  pointsAwarded     Int?      // 游戏化积分
  streakAtAnswer    Int?      // 答题时的连胜数
  
  // 添加索引优化查询
  @@index([attemptId, stepNumber])
  @@index([attemptId, isCorrect])
}

// ============ 新增游戏化表（与学习核心解耦） ============

// 游戏化配置
model GamingProfile {
  id              String   @id @default(cuid())
  userId          String   @unique
  activeThemeId   String   @default("magic-academy")
  soundEnabled    Boolean  @default(false)
  selectedCareer  String?  // 职业养成：选择的职业
  nickname        String?  // 排行榜显示的昵称（隐私）
  showRanking     Boolean  @default(true)  // 是否在排行榜显示
  parentPin       String?  // 家长控制PIN码
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
}

// 连胜记录（基于LE，而非简单答对）
model StreakRecord {
  id              String   @id @default(cuid())
  userId          String   @unique
  currentStreak   Int      @default(0)  // 当前LE>0.15的连续次数
  bestStreak      Int      @default(0)
  lastStreakAt    DateTime?
  isInRebound     Boolean  @default(false)
  reboundCount    Int      @default(0)
  totalLE         Float    @default(0)   // 累计学习效果（用于验证连胜质量）
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // 排行榜查询索引
  @@index([currentStreak, bestStreak])
}

// 暴击记录（用于分析，不影响学习核心）
model CriticalHitLog {
  id              String   @id @default(cuid())
  userId          String
  attemptStepId   String   @unique  // 关联到具体答题
  difficulty      Int
  multiplier      Int      // 1-5倍
  pointsAwarded   Int
  rolledAt        DateTime @default(now())
  
  attemptStep     AttemptStep @relation(fields: [attemptStepId], references: [id])
  
  @@index([userId, rolledAt])
}

// 成就定义
model Achievement {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String
  icon        String?
  rarity      String   @default("common")
  points      Int      @default(0)
  category    String   // streak | progress | social | parent
  requirement  String   @default("{}")
  isEnabled   Boolean  @default(true)  // 家长可禁用某些成就
}

// 用户成就
model UserAchievement {
  id            String      @id @default(cuid())
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  showcaseOrder Int?
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  
  @@unique([userId, achievementId])
  @@index([userId, unlockedAt])
}

// 社交：班级关联
model ClassMembership {
  id        String   @id @default(cuid())
  userId    String   @unique
  className String
  grade     Int
  role      String   @default("student")
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([className, grade])
}

// 社交：挑战
model Challenge {
  id              String   @id @default(cuid())
  challengerId    String
  receiverId      String
  attemptStepId   String   // 关联到出题者的答题记录
  difficulty      Int
  challengerStake Int      @default(10)
  receiverStake   Int      @default(20)
  status          String   @default("pending")
  winnerId        String?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  
  @@index([receiverId, status, createdAt])  // 复合索引
  @@index([challengerId, createdAt])
}

// 社交：组队
model Team {
  id          String   @id @default(cuid())
  name        String
  bossAttemptStepId String  // Boss题的attemptStep
  status      String   @default("forming")
  createdAt   DateTime @default(now())
  members     TeamMember[]
}

model TeamMember {
  id          String   @id @default(cuid())
  teamId      String
  userId      String
  status      String   @default("ready")
  joinedAt    DateTime @default(now())
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  @@unique([teamId, userId])
  @@index([teamId, status])
}

// 家长控制：使用限制
model ParentalControl {
  id                String   @id @default(cuid())
  userId            String   @unique
  dailyTimeLimit    Int?     // 每日时间限制（分钟）
  gamingEnabled     Boolean  @default(true)   // 是否启用游戏化
  rankingEnabled    Boolean  @default(true)   // 是否显示排行榜
  challengeEnabled  Boolean  @default(true)   // 是否允许挑战
  soundEnabled      Boolean  @default(false)  // 是否允许音效
  allowedHoursStart Int?     // 允许使用时段开始
  allowedHoursEnd   Int?     // 允许使用时段结束
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
}

// 家长控制：使用日志
model UsageLog {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @default(now())
  minutesUsed Int      @default(0)
  questionsAnswered Int  @default(0)
  leGained    Float    @default(0)
  
  @@unique([userId, date])
  @@index([userId, date])
}

// A/B实验集成：扩展现有实验
model ExperimentVariant {
  id              String   @id @default(cuid())
  experimentId    String   // 关联到现有EffectExperiment
  userId          String
  variant         String   // 'gamification' | 'control' | 'theme-magic' | ...
  assignedAt      DateTime @default(now())
  leScore         Float?   // 该变体的LE得分
  engagementScore Float?   // 参与度得分
  
  @@unique([experimentId, userId])
  @@index([experimentId, variant])
}

// 更新User模型
model User {
  // ... 现有字段保持不变 ...
  gamingProfile      GamingProfile?
  streakRecord       StreakRecord?
  classMembership    ClassMembership?
  criticalHits       CriticalHitLog[]
  achievements       UserAchievement[]
  challengesSent     Challenge[]       @relation("Challenger")
  challengesReceived Challenge[]       @relation("Receiver")
  teamMemberships    TeamMember[]
  parentalControl    ParentalControl?
  usageLogs          UsageLog[]
  experimentVariants ExperimentVariant[]
}
```

**运行迁移**:
```bash
npx prisma migrate dev --name add_gamification_v2
npx prisma generate
```

---

## 核心系统实现（修订版）

### Task 2: 学习事件监听器（解耦核心）

**文件**: `lib/gaming/event-listener.ts`

```typescript
/**
 * 游戏化事件监听器
 * 
 * 核心原则：
 * 1. 只监听学习事件，不修改学习流程
 * 2. 所有游戏化计算基于完整的学习事件
 * 3. 暴击等随机事件不影响学习指标
 */

import type { Attempt, AttemptStep } from '@prisma/client';
import type { CausalContext } from '@/lib/qie/types';
import { updateStreakFromLE } from './streak-tracker';
import { checkAchievements } from './achievement-system';
import { rollCriticalHit } from './critical-hit';
import { recordUsage } from './parent-control';

/**
 * 处理答题完成事件
 * 
 * @param attemptStep - 答题记录（包含完整的学习上下文）
 * @param causalContext - 因果上下文（包含hint_effect, learning_effect等）
 * @param recommendation - AI推荐信息
 */
export async function onAnswerSubmitted(
  attemptStep: AttemptStep & { question: { difficulty: number } },
  causalContext: CausalContext,
  recommendation: {
    questionId: string;
    deltaC: number;  // 复杂度增量
    leDelta: number; // 预测LE增量
  }
) {
  // 1. 计算真实的学习效果（排除暴击等噪声）
  const trueLE = calculateTrueLE(attemptStep.isCorrect, causalContext);
  
  // 2. 更新连胜（基于LE，而非简单答对）
  const streakUpdate = await updateStreakFromLE({
    userId: attemptStep.attemptId,  // 从attempt获取userId
    le: trueLE,
    isRecommended: recommendation.deltaC < 0.5,  // 基于真实推荐判断
  });
  
  // 3. 计算暴击（只影响积分，不影响学习指标）
  const criticalHit = rollCriticalHit(attemptStep.question.difficulty);
  
  // 4. 计算游戏化积分
  const basePoints = calculateBasePoints(attemptStep.question.difficulty);
  const points = Math.floor(basePoints * streakUpdate.multiplier * criticalHit.multiplier);
  
  // 5. 记录暴击日志（用于分析，不影响学习核心）
  if (criticalHit.isCritical) {
    await prisma.criticalHitLog.create({
      data: {
        userId: attemptStep.attemptId,  // 从attempt获取
        attemptStepId: attemptStep.id,
        difficulty: attemptStep.question.difficulty,
        multiplier: criticalHit.multiplier,
        pointsAwarded: points,
      },
    });
  }
  
  // 6. 检查成就解锁
  const newAchievements = await checkAchievements({
    userId: attemptStep.attemptId,
    le: trueLE,
    streak: streakUpdate.newStreak,
  });
  
  // 7. 更新使用日志（家长控制）
  await recordUsage({
    userId: attemptStep.attemptId,
    le: trueLE,
  });
  
  return {
    points,
    streakUpdate,
    criticalHit,
    newAchievements,
    trueLE,  // 返回真实LE，用于验证
  };
}

/**
 * 计算真实学习效果
 * 排除：hint_effect, guessing_effect, fatigue_effect, critical_hit
 */
function calculateTrueLE(
  isCorrect: boolean,
  causalContext: CausalContext
): number {
  if (!isCorrect) return 0;
  
  // 基础学习效果
  let le = 0.1; // 默认10%基础学习
  
  // 排除提示影响
  if (causalContext.hint_effect > 0) {
    le *= (1 - causalContext.hint_effect * 0.5);
  }
  
  // 排除猜测影响
  if (causalContext.guessing_effect > 0) {
    le *= (1 - causalContext.guessing_effect);
  }
  
  // 疲劳影响
  if (causalContext.fatigue_effect > 0) {
    le *= (1 - causalContext.fatigue_effect * 0.3);
  }
  
  return Math.max(0, le);
}
```

---

### Task 3: 连胜追踪器（基于LE）

**文件**: `lib/gaming/streak-tracker.ts`

```typescript
/**
 * 基于学习效果的连胜追踪器
 * 
 * 修复：连胜基于LE>0.15，而非简单答对
 * 这样可以激励学生真正学习，而不是刷简单题
 */

import type { StreakState, StreakUpdateResult } from '@/types/gaming';

const LE_THRESHOLD = 0.15; // LE阈值，与产品目标一致

const STREAK_THRESHOLDS = [
  { streak: 3, multiplier: 1.5, message: '状态来了！' },
  { streak: 5, multiplier: 2.0, message: '势不可挡！' },
  { streak: 10, multiplier: 3.0, message: '超神模式！' },
];

/**
 * 基于LE更新连胜
 */
export async function updateStreakFromLE(input: {
  userId: string;
  le: number;
  isRecommended: boolean;
}): Promise<StreakUpdateResult> {
  // 防护：非推荐题不计入连胜
  if (!input.isRecommended) {
    return {
      newStreak: 0,
      isBroken: false,
      multiplier: 1.0,
      message: '推荐题答题才能计入连胜哦',
      shouldShowAnimation: false,
    };
  }
  
  // 只有LE>阈值才算有效连胜
  const isValidStreak = input.le >= LE_THRESHOLD;
  
  // 获取当前连胜状态
  const current = await prisma.streakRecord.findUnique({
    where: { userId: input.userId },
  });
  
  const currentStreak = current?.currentStreak || 0;
  
  if (isValidStreak) {
    // 有效学习：增加连胜
    const newStreak = currentStreak + 1;
    const multiplier = calculateMultiplier(newStreak);
    const isNewBest = newStreak > (current?.bestStreak || 0);
    
    await prisma.streakRecord.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        currentStreak: newStreak,
        bestStreak: newStreak,
        totalLE: input.le,
      },
      update: {
        currentStreak: newStreak,
        bestStreak: isNewBest ? newStreak : undefined,
        totalLE: { increment: input.le },
        lastStreakAt: new Date(),
      },
    });
    
    return {
      newStreak,
      isBroken: false,
      multiplier,
      message: getStreakMessage(newStreak),
      shouldShowAnimation: isMilestone(newStreak),
      isNewBest,
    };
  } else {
    // 无效学习：连胜中断
    await prisma.streakRecord.update({
      where: { userId: input.userId },
      data: {
        currentStreak: 0,
        isInRebound: true,
        reboundCount: 0,
      },
    });
    
    return {
      newStreak: 0,
      isBroken: true,
      multiplier: 1.0,
      message: '连胜中断了...',
      shouldShowAnimation: true,
      enterRebound: true,
    };
  }
}

function calculateMultiplier(streak: number): number {
  for (const t of [...STREAK_THRESHOLDS].reverse()) {
    if (streak >= t.streak) return t.multiplier;
  }
  return 1.0;
}

function getStreakMessage(streak: number): string {
  for (const t of [...STREAK_THRESHOLDS].reverse()) {
    if (streak === t.streak) return t.message;
  }
  return `${streak}连胜！`;
}

function isMilestone(streak: number): boolean {
  return STREAK_THRESHOLDS.some(t => t.streak === streak);
}
```

---

### Task 4: 暴击系统（噪声隔离）

**文件**: `lib/gaming/critical-hit.ts`

```typescript
/**
 * 暴击系统（修订版）
 * 
 * 核心原则：
 * 1. 暴击只影响积分奖励
 * 2. 暴击事件记录在CriticalHitLog中
 * 3. 在计算LE时排除暴击影响
 */

import type { CriticalHitResult } from '@/types/gaming';

// 暴击概率
const CRIT_RATES = {
  easy: 0.05,
  medium: 0.02,
  hard: 0.01,
};

/**
 * 计算暴击
 * 
 * 注意：这个结果只用于积分计算
 * 学习核心的IRT估计不应该被暴击影响
 */
export function rollCriticalHit(difficulty: number): CriticalHitResult {
  const difficultyLevel =
    difficulty <= 3 ? 'easy' :
    difficulty <= 6 ? 'medium' : 'hard';
  
  const critRate = CRIT_RATES[difficultyLevel];
  const roll = Math.random();
  
  if (roll < critRate * 0.05) {
    return {
      isCritical: true,
      multiplier: 5,
      animation: 'legendary',
    };
  }
  
  if (roll < critRate * 0.2) {
    return {
      isCritical: true,
      multiplier: 3,
      animation: 'epic',
    };
  }
  
  if (roll < critRate) {
    return {
      isCritical: true,
      multiplier: 2,
      animation: 'rare',
    };
  }
  
  return {
    isCritical: false,
    multiplier: 1,
    animation: 'normal',
  };
}

/**
 * 排除暴击影响的LE计算
 * 
 * 当暴击发生时，学生可能因兴奋答对了
 * 但这不代表真实能力提升
 * 
 * 这个函数用于学习核心，确保IRT估计的准确性
 */
export function adjustLEForCriticalHit(
  le: number,
  isCriticalHit: boolean
): number {
  if (!isCriticalHit) return le;
  
  // 暴击时答对，LE打折计算
  // 因为这可能只是运气好
  return le * 0.5;
}
```

---

### Task 5: 家长控制系统

**文件**: `lib/gaming/parent-control.ts`

```typescript
/**
 * 家长控制系统
 * 
 * 功能：
 * 1. 查看学习报告
 * 2. 设置使用时间限制
 * 3. 游戏化功能开关
 * 4. 使用时段控制
 */

import { prisma } from '@/lib/db';

export interface ParentalSettings {
  dailyTimeLimit?: number;     // 分钟
  gamingEnabled: boolean;
  rankingEnabled: boolean;
  challengeEnabled: boolean;
  soundEnabled: boolean;
  allowedHoursStart?: number;  // 0-23小时
  allowedHoursEnd?: number;
}

/**
 * 获取家长控制设置
 */
export async function getParentalSettings(userId: string): Promise<ParentalSettings> {
  const control = await prisma.parentalControl.findUnique({
    where: { userId },
  });
  
  return {
    dailyTimeLimit: control?.dailyTimeLimit ?? undefined,
    gamingEnabled: control?.gamingEnabled ?? true,
    rankingEnabled: control?.rankingEnabled ?? true,
    challengeEnabled: control?.challengeEnabled ?? true,
    soundEnabled: control?.soundEnabled ?? false,
    allowedHoursStart: control?.allowedHoursStart ?? undefined,
    allowedHoursEnd: control?.allowedHoursEnd ?? undefined,
  };
}

/**
 * 更新家长控制设置
 */
export async function updateParentalSettings(
  userId: string,
  settings: Partial<ParentalSettings>
): Promise<void> {
  await prisma.parentalControl.upsert({
    where: { userId },
    create: {
      userId,
      ...settings,
    },
    update: settings,
  });
}

/**
 * 检查是否允许使用游戏化
 */
export async function checkGamingAccess(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const settings = await getParentalSettings(userId);
  
  // 检查是否启用游戏化
  if (!settings.gamingEnabled) {
    return { allowed: false, reason: '游戏化功能已被家长禁用' };
  }
  
  // 检查时段限制
  if (settings.allowedHoursStart !== undefined && settings.allowedHoursEnd !== undefined) {
    const now = new Date();
    const currentHour = now.getHours();
    
    const isWithinHours = currentHour >= settings.allowedHoursStart &&
                          currentHour < settings.allowedHoursEnd;
    
    if (!isWithinHours) {
      return { allowed: false, reason: '当前时段不允许使用' };
    }
  }
  
  // 检查每日时间限制
  if (settings.dailyTimeLimit !== undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usage = await prisma.usageLog.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });
    
    if (usage && usage.minutesUsed >= settings.dailyTimeLimit) {
      return { allowed: false, reason: '今日使用时间已达上限' };
    }
  }
  
  return { allowed: true };
}

/**
 * 获取学习报告（家长查看）
 */
export async function getLearningReport(userId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const usageLogs = await prisma.usageLog.findMany({
    where: {
      userId,
      date: { gte: startDate },
    },
    orderBy: { date: 'asc' },
  });
  
  const streakRecord = await prisma.streakRecord.findUnique({
    where: { userId },
  });
  
  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' },
    take: 10,
  });
  
  return {
    period: {
      start: startDate,
      end: new Date(),
      days,
    },
    usage: {
      totalMinutes: usageLogs.reduce((sum, log) => sum + log.minutesUsed, 0),
      totalQuestions: usageLogs.reduce((sum, log) => sum + log.questionsAnswered, 0),
      totalLE: usageLogs.reduce((sum, log) => sum + log.leGained, 0),
      dailyData: usageLogs,
    },
    streak: {
      current: streakRecord?.currentStreak || 0,
      best: streakRecord?.bestStreak || 0,
    },
    achievements: achievements.map(a => ({
      name: a.achievement.name,
      unlockedAt: a.unlockedAt,
    })),
  };
}
```

---

### Task 6: 排行榜系统（带缓存）

**文件**: `lib/gaming/ranking-system.ts`

```typescript
/**
 * 排行榜系统（带Redis缓存）
 * 
 * 修复性能问题：
 * 1. 使用Redis缓存排行榜
 * 2. 每5分钟更新一次
 * 3. 避免每次请求全表扫描
 */

import { prisma } from '@/lib/db';
import { rankingCache } from './ranking-cache';

const CACHE_TTL = 300; // 5分钟缓存

/**
 * 获取全服排行榜
 */
export async function getGlobalRankings(userId: string) {
  // 先尝试从缓存获取
  const cached = await rankingCache.get('global');
  
  if (cached) {
    const myRank = await getMyRank(userId, cached.rankings);
    return {
      ...cached,
      yourRank: myRank,
    };
  }
  
  // 缓存未命中，计算排行榜
  const rankings = await calculateGlobalRankings();
  
  // 写入缓存
  await rankingCache.set('global', rankings, CACHE_TTL);
  
  const myRank = await getMyRank(userId, rankings);
  
  return {
    ...rankings,
    yourRank: myRank,
  };
}

/**
 * 计算全服排行榜（优化版）
 */
async function calculateGlobalRankings() {
  // 使用原生SQL优化查询
  const results = await prisma.$queryRaw<Array<{
    userId: string;
    userName: string;
    score: number;
    currentStreak: number;
    themeId: string;
    level: number;
  }>>`
    SELECT 
      u.id as userId,
      COALESCE(u.name, '同学') as userName,
      COALESCE(s.currentStreak, 0) * 10 + COALESCE(s.bestStreak, 0) * 5 as score,
      COALESCE(s.currentStreak, 0) as currentStreak,
      COALESCE(g.activeThemeId, 'magic-academy') as themeId,
      1 as level
    FROM User u
    LEFT JOIN StreakRecord s ON s.userId = u.id
    LEFT JOIN GamingProfile g ON g.userId = u.id
    WHERE s.currentStreak > 0 OR s.bestStreak > 0
    ORDER BY score DESC
    LIMIT 10
  `;
  
  return {
    type: 'global',
    rankings: results.map((r, i) => ({
      ...r,
      rank: i + 1,
      change: 0,
    })),
    updatedAt: new Date(),
  };
}

/**
 * 获取班级排行榜
 */
export async function getClassRankings(userId: string) {
  const classMembership = await prisma.classMembership.findUnique({
    where: { userId },
  });
  
  if (!classMembership) {
    return {
      type: 'class',
      className: '',
      grade: 0,
      rankings: [],
      yourRank: null,
      classAverage: 0,
    };
  }
  
  // 尝试缓存
  const cacheKey = `class:${classMembership.className}:${classMembership.grade}`;
  const cached = await rankingCache.get(cacheKey);
  
  if (cached) {
    const myRank = await getMyRank(userId, cached.rankings);
    return {
      ...cached,
      yourRank: myRank,
    };
  }
  
  // 计算班级排行榜
  const results = await prisma.$queryRaw<Array<any>>`
    SELECT 
      u.id as userId,
      COALESCE(u.name, '同学') as userName,
      COALESCE(s.currentStreak, 0) * 10 + COALESCE(s.bestStreak, 0) * 5 as score,
      COALESCE(s.currentStreak, 0) as currentStreak
    FROM User u
    LEFT JOIN StreakRecord s ON s.userId = u.id
    INNER JOIN ClassMembership c ON c.userId = u.id
    WHERE c.className = ${classMembership.className}
      AND c.grade = ${classMembership.grade}
    ORDER BY score DESC
  `;
  
  const rankings = results.map((r, i) => ({
    ...r,
    rank: i + 1,
    change: 0,
  }));
  
  const classAverage = rankings.length > 0
    ? rankings.reduce((sum, r) => sum + r.score, 0) / rankings.length
    : 0;
  
  const rankingData = {
    type: 'class',
    className: classMembership.className,
    grade: classMembership.grade,
    rankings,
    classAverage: Math.round(classAverage),
    updatedAt: new Date(),
  };
  
  await rankingCache.set(cacheKey, rankingData, CACHE_TTL);
  
  const myRank = await getMyRank(userId, rankings);
  
  return {
    ...rankingData,
    yourRank: myRank,
  };
}

async function getMyRank(userId: string, rankings: any[]): Promise<number | null> {
  const myEntry = rankings.find(r => r.userId === userId);
  return myEntry ? myEntry.rank : null;
}
```

**缓存实现**: `lib/gaming/ranking-cache.ts`

```typescript
/**
 * 排行榜缓存（Redis）
 * 
 * 如果Redis不可用，降级到内存缓存
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class RankingCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  
  async get<T>(key: string): Promise<T | null> {
    try {
      // 尝试Redis
      // const cached = await redis.get(`ranking:${key}`);
      // if (cached) return JSON.parse(cached);
      
      // 降级到内存缓存
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        expiresAt: Date.now() + ttl * 1000,
      };
      
      // 写入内存缓存
      this.memoryCache.set(key, entry);
      
      // 写入Redis（如果可用）
      // await redis.setex(`ranking:${key}`, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    try {
      // 清除内存缓存
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(pattern)) {
          this.memoryCache.delete(key);
        }
      }
      
      // 清除Redis缓存
      // const keys = await redis.keys(`ranking:${pattern}*`);
      // if (keys.length > 0) await redis.del(...keys);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
}

export const rankingCache = new RankingCache();
```

---

### Task 7: 挑战系统（带安全）

**文件**: `lib/gaming/challenge-system.ts`

```typescript
/**
 * 挑战系统（修订版 - 带安全措施）
 * 
 * 安全措施：
 * 1. 速率限制（每小时最多5次）
 * 2. 最小连胜要求
 * 3. 积分上限
 */

import { prisma } from '@/lib/db';

const MAX_CHALLENGES_PER_HOUR = 5;
const MIN_STREAK_TO_CHALLENGE = 3;
const MAX_STAKE_PERCENTAGE = 0.2; // 最多赌20%积分

/**
 * 创建挑战（带安全验证）
 */
export async function createChallenge(
  challengerId: string,
  receiverId: string,
  attemptStepId: string,
  difficulty: number
) {
  // 1. 验证发起者资格
  const challengerStreak = await prisma.streakRecord.findUnique({
    where: { userId: challengerId },
  });
  
  if (!challengerStreak || challengerStreak.currentStreak < MIN_STREAK_TO_CHALLENGE) {
    throw new Error(`需要至少${MIN_STREAK_TO_CHALLENGE}连胜才能发起挑战`);
  }
  
  // 2. 速率限制检查
  const recentChallenges = await prisma.challenge.count({
    where: {
      challengerId,
      createdAt: { gte: new Date(Date.now() - 3600000) }, // 1小时内
    },
  });
  
  if (recentChallenges >= MAX_CHALLENGES_PER_HOUR) {
    throw new Error('挑战次数已达上限，请1小时后再试');
  }
  
  // 3. 计算赌注（限制上限）
  const challengerPoints = await calculateUserPoints(challengerId);
  const challengerStake = Math.min(
    Math.floor(challengerPoints * MAX_STAKE_PERCENTAGE),
    challengerStreak.currentStreak * 5
  );
  
  const receiverPoints = await calculateUserPoints(receiverId);
  const receiverStake = Math.min(
    Math.floor(receiverPoints * MAX_STAKE_PERCENTAGE),
    challengerStake * 2
  );
  
  // 4. 创建挑战
  const challenge = await prisma.challenge.create({
    data: {
      challengerId,
      receiverId,
      attemptStepId,
      difficulty,
      challengerStake,
      receiverStake,
    },
  });
  
  // TODO: 发送通知给接收者
  
  return challenge;
}

/**
 * 接受挑战
 */
export async function acceptChallenge(challengeId: string, receiverId: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });
  
  if (!challenge || challenge.receiverId !== receiverId) {
    throw new Error('挑战不存在');
  }
  
  if (challenge.status !== 'pending') {
    throw new Error('挑战已被处理');
  }
  
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'accepted' },
  });
}

/**
 * 拒绝挑战（损失5分）
 */
export async function declineChallenge(challengeId: string, receiverId: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });
  
  if (!challenge || challenge.receiverId !== receiverId) {
    throw new Error('挑战不存在');
  }
  
  await prisma.$transaction([
    // 更新挑战状态
    prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'declined' },
    }),
    // 扣除接收者5分
    deductPoints(receiverId, 5),
  ]);
}

/**
 * 提交挑战结果
 */
export async function submitChallengeResult(
  challengeId: string,
  receiverCorrect: boolean
) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });
  
  if (!challenge || challenge.status !== 'accepted') {
    throw new Error('挑战不存在或状态错误');
  }
  
  await prisma.$transaction(async (tx) => {
    if (receiverCorrect) {
      // 接收者答对：发起者失去10%积分
      await deductPoints(challenge.challengerId, challenge.challengerStake);
      await tx.challenge.update({
        where: { id: challengeId },
        data: {
          status: 'completed',
          winnerId: challenge.receiverId,
          completedAt: new Date(),
        },
      });
    } else {
      // 接收者答错：发起者获得20%积分
      await addPoints(challenge.challengerId, challenge.receiverStake);
      await tx.challenge.update({
        where: { id: challengeId },
        data: {
          status: 'completed',
          winnerId: challenge.challengerId,
          completedAt: new Date(),
        },
      });
    }
  });
}

async function calculateUserPoints(userId: string): Promise<number> {
  const streak = await prisma.streakRecord.findUnique({
    where: { userId },
  });
  
  if (!streak) return 0;
  
  return streak.currentStreak * 10 + streak.bestStreak * 5;
}

async function deductPoints(userId: string, points: number): Promise<void> {
  // 实现积分扣除
  // 可以通过减少currentStreak或添加专门的积分表
}

async function addPoints(userId: string, points: number): Promise<void> {
  // 实现积分增加
}
```

---

### Task 8: A/B实验集成

**文件**: `lib/gaming/experiment-integration.ts`

```typescript
/**
 * A/B实验集成
 * 
 * 用于验证游戏化效果：
 * 1. 游戏化 vs 无游戏化
 * 2. 不同主题的效果对比
 * 3. 暴击系统的影响
 */

import { prisma } from '@/lib/db';

export type ExperimentVariant = 
  | 'control'           // 无游戏化
  | 'gamification'      // 完整游戏化
  | 'theme-magic'       // 仅魔法学院主题
  | 'theme-career'      // 仅职业主题
  | 'no-critical'       // 无暴击系统
  | 'no-ranking';       // 无排行榜

/**
 * 分配实验变体
 */
export async function assignVariant(userId: string): Promise<ExperimentVariant> {
  // 检查是否已分配
  const existing = await prisma.experimentVariant.findFirst({
    where: {
      userId,
      experimentId: 'gamification-effect',
    },
  });
  
  if (existing) {
    return existing.variant as ExperimentVariant;
  }
  
  // 随机分配
  const variants: ExperimentVariant[] = [
    'control',
    'gamification',
    'theme-magic',
    'theme-career',
    'no-critical',
    'no-ranking',
  ];
  
  const variant = variants[Math.floor(Math.random() * variants.length)];
  
  await prisma.experimentVariant.create({
    data: {
      experimentId: 'gamification-effect',
      userId,
      variant,
    },
  });
  
  return variant;
}

/**
 * 记录实验数据
 */
export async function recordExperimentData(
  userId: string,
  data: {
    leScore: number;
    engagementScore: number;
    timeSpent: number;
    questionsAnswered: number;
  }
) {
  await prisma.experimentVariant.updateMany({
    where: {
      userId,
      experimentId: 'gamification-effect',
    },
    data: {
      leScore: data.leScore,
      engagementScore: data.engagementScore,
    },
  });
}

/**
 * 获取实验结果
 */
export async function getExperimentResults() {
  const results = await prisma.experimentVariant.groupBy({
    by: ['variant'],
    where: { experimentId: 'gamification-effect' },
    _avg: {
      leScore: true,
      engagementScore: true,
    },
    _count: true,
  });
  
  return results.map(r => ({
    variant: r.variant,
    avgLE: r._avg.leScore,
    avgEngagement: r._avg.engagementScore,
    sampleSize: r._count,
  }));
}
```

---

## UI组件实现（修订版）

### Task 9: 家长控制面板

**文件**: `components/gaming/parent/ParentControlPanel.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { gamingApi } from '@/lib/api';

export function ParentControlPanel() {
  const [settings, setSettings] = useState({
    dailyTimeLimit: undefined as number | undefined,
    gamingEnabled: true,
    rankingEnabled: true,
    challengeEnabled: true,
    soundEnabled: false,
    allowedHoursStart: undefined as number | undefined,
    allowedHoursEnd: undefined as number | undefined,
  });
  
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [settingsData, reportData] = await Promise.all([
        gamingApi.getParentalSettings(),
        gamingApi.getLearningReport(7),
      ]);
      
      setSettings(settingsData);
      setReport(reportData);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateSettings = async (newSettings: typeof settings) => {
    await gamingApi.updateParentalSettings(newSettings);
    setSettings(newSettings);
  };
  
  if (loading) {
    return <div>加载中...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* 学习报告 */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">📊 学习报告（近7天）</h2>
        
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-variant/20 rounded-lg p-4">
              <div className="text-sm text-on-surface-variant">学习时间</div>
              <div className="text-2xl font-bold text-white">
                {Math.floor(report.usage.totalMinutes / 60)}小时
              </div>
            </div>
            <div className="bg-surface-variant/20 rounded-lg p-4">
              <div className="text-sm text-on-surface-variant">答题数</div>
              <div className="text-2xl font-bold text-white">
                {report.usage.totalQuestions}
              </div>
            </div>
            <div className="bg-surface-variant/20 rounded-lg p-4">
              <div className="text-sm text-on-surface-variant">学习效果</div>
              <div className="text-2xl font-bold text-green-400">
                {(report.usage.totalLE * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-surface-variant/20 rounded-lg p-4">
              <div className="text-sm text-on-surface-variant">最佳连胜</div>
              <div className="text-2xl font-bold text-orange-400">
                {report.streak.best}
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* 控制开关 */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">🔧 功能设置</h2>
        
        <div className="space-y-4">
          <Toggle
            label="启用游戏化"
            value={settings.gamingEnabled}
            onChange={(v) => handleUpdateSettings({ ...settings, gamingEnabled: v })}
            description="关闭后将显示传统学习界面"
          />
          
          <Toggle
            label="显示排行榜"
            value={settings.rankingEnabled}
            onChange={(v) => handleUpdateSettings({ ...settings, rankingEnabled: v })}
            description="关闭后减少社交压力"
          />
          
          <Toggle
            label="允许挑战"
            value={settings.challengeEnabled}
            onChange={(v) => handleUpdateSettings({ ...settings, challengeEnabled: v })}
            description="关闭后禁止PK功能"
          />
          
          <Toggle
            label="允许音效"
            value={settings.soundEnabled}
            onChange={(v) => handleUpdateSettings({ ...settings, soundEnabled: v })}
            description="默认关闭，适合教室环境"
          />
        </div>
      </section>
      
      {/* 时间限制 */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">⏰ 使用限制</h2>
        
        <div className="space-y-4">
          <NumberInput
            label="每日时间限制（分钟）"
            value={settings.dailyTimeLimit}
            onChange={(v) => handleUpdateSettings({ ...settings, dailyTimeLimit: v })}
            placeholder="不限制"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="允许开始时间（小时）"
              value={settings.allowedHoursStart}
              onChange={(v) => handleUpdateSettings({ ...settings, allowedHoursStart: v })}
              min={0}
              max={23}
              placeholder="不限制"
            />
            <NumberInput
              label="允许结束时间（小时）"
              value={settings.allowedHoursEnd}
              onChange={(v) => handleUpdateSettings({ ...settings, allowedHoursEnd: v })}
              min={0}
              max={23}
              placeholder="不限制"
            />
          </div>
        </div>
      </section>
      
      {/* PIN设置 */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">🔒 家长PIN码</h2>
        <Button onClick={handleSetupPin}>设置/修改PIN码</Button>
      </section>
    </div>
  );
}
```

---

## API路由实现（修订版）

### Task 10: 游戏化API（完整版）

**10.1 连胜API**
```typescript
// app/api/gaming/streak/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const streak = await prisma.streakRecord.findUnique({
    where: { userId: session.user.id },
  });
  
  return NextResponse.json({
    current: streak?.currentStreak || 0,
    best: streak?.bestStreak || 0,
    isInRebound: streak?.isInRebound || false,
    totalLE: streak?.totalLE || 0,
  });
}
```

**10.2 家长控制API**
```typescript
// app/api/gaming/parent/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getParentalSettings, updateParentalSettings, getLearningReport } from '@/lib/gaming/parent-control';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  // 验证PIN码
  const pin = req.headers.get('X-Parent-Pin');
  if (!pin) {
    return NextResponse.json({ error: '需要PIN码' }, { status: 403 });
  }
  
  const control = await prisma.parentalControl.findUnique({
    where: { userId: session.user.id },
  });
  
  if (control?.parentPin !== pin) {
    return NextResponse.json({ error: 'PIN码错误' }, { status: 403 });
  }
  
  const { searchParams } = new URL(req.url);
  const report = searchParams.get('report') === 'true';
  
  if (report) {
    const data = await getLearningReport(session.user.id, 7);
    return NextResponse.json(data);
  }
  
  const settings = await getParentalSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const pin = req.headers.get('X-Parent-Pin');
  if (!pin) {
    return NextResponse.json({ error: '需要PIN码' }, { status: 403 });
  }
  
  const settings = await req.json();
  await updateParentalSettings(session.user.id, settings);
  
  return NextResponse.json({ success: true });
}
```

**10.3 A/B实验API**
```typescript
// app/api/gaming/experiment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assignVariant, getExperimentResults } from '@/lib/gaming/experiment-integration';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  
  if (action === 'results') {
    const results = await getExperimentResults();
    return NextResponse.json(results);
  }
  
  return NextResponse.json({ error: '无效操作' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const variant = await assignVariant(session.user.id);
  return NextResponse.json({ variant });
}
```

---

## 修改现有组件（修订版）

### Task 11: 集成到练习页面（正确方式）

**修改文件**: `components/ExercisePage.tsx`

```typescript
// 在答题结果处理中
import { onAnswerSubmitted } from '@/lib/gaming/event-listener';
import { checkGamingAccess } from '@/lib/gaming/parent-control';

// 答题提交处理
const handleSubmitAnswer = async (answer: string) => {
  // 1. 先完成学习核心流程（保持不变）
  const result = await submitAnswer(answer);
  
  // 2. 检查家长控制
  const gamingAccess = await checkGamingAccess(userId);
  if (!gamingAccess.allowed) {
    // 游戏化被禁用，只显示学习反馈
    showLearningFeedback(result);
    return;
  }
  
  // 3. 通过游戏化事件监听器处理
  const gamingResult = await onAnswerSubmitted(
    result.attemptStep,
    result.causalContext,
    result.recommendation
  );
  
  // 4. 显示游戏化反馈
  showGamingFeedback(gamingResult);
};
```

---

## 验收标准（修订版）

### 功能完整性
- [ ] 四个主题全部可用
- [ ] 连胜基于LE（>0.15）而非简单答对
- [ ] 暴击只影响积分，不影响学习指标
- [ ] 全服排行榜（带缓存）
- [ ] 班级排行榜
- [ ] 挑战系统（带速率限制）
- [ ] 组队Boss战
- [ ] 成就系统
- [ ] 家长控制面板
- [ ] A/B实验集成

### 核心指标保护
- [ ] **DFI ≥ 0.99** - 学习事件链完整
- [ ] **LE > 0.15** - 学习有效性不降低
- [ ] **CS ≥ 0.85** - 收敛稳定性保持

### 安全性
- [ ] 挑战系统速率限制
- [ ] 组队权限验证
- [ ] 家长PIN码保护
- [ ] 排行榜隐私保护

### 性能
- [ ] 排行榜响应时间 < 200ms（缓存命中）
- [ ] 反馈动画延迟 < 50ms
- [ ] 数据库查询优化

---

## 实施顺序

### Week 1-2: 基础设施（解耦优先）
- Task 1: 数据库设计（扩展现有表）
- Task 2: 事件监听器（核心解耦）
- Task 3: 连胜追踪器（基于LE）
- Task 4: 暴击系统（噪声隔离）

### Week 3-4: 游戏化功能
- Task 5: 家长控制
- Task 6: 排行榜系统（带缓存）
- Task 7: 挑战系统（带安全）
- Task 8: A/B实验集成

### Week 5-6: UI集成
- 四主题UI组件
- 反馈动画
- 家长控制面板
- 练习页面集成

### Week 7-8: 测试和打磨
- 单元测试
- E2E测试
- 性能测试
- A/B实验验证

---

*计划版本: V2（修订版）*
*修订日期: 2026-04-30*
*基于: 审核反馈 + 学习核心解耦*
