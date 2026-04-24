# 自适应学习路径系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 构建自适应学习路径系统，根据测评结果和日常练习表现动态调整学习优先级。

**架构:** 分层设计 - 数据层(Prisma) → 业务层(优先级计算、路径调整) → API层 → UI层

**技术栈:** Prisma, Next.js API Routes, React, TypeScript, Zod验证

---

## 文件结构

```
prisma/schema.prisma                    # 数据模型
lib/learning-path/
  ├── priority.ts                       # 优先级计算逻辑
  ├── adapter.ts                        # 微调逻辑
  ├── types.ts                          # 共享类型定义
  └── weekly-job.ts                     # 周报生成服务
app/api/learning-path/
  ├── generate/route.ts                 # 路径生成API
  ├── route.ts                          # 路径查询API
  ├── adjust/route.ts                   # 微调API
  ├── weekly-report/route.ts            # 周报查询API
  └── recalibrate/route.ts              # 重组API
components/
  ├── LearningPathOverview.tsx          # 路径概览卡片
  ├── LearningPathRoadmap.tsx           # 路径可视化
  ├── WeeklyReportDialog.tsx            # 周报弹窗
  └── KnowledgeTreeWithPath.tsx         # 知识树+路径集成
app/assessment/result/page.tsx          # 修改: 添加路径生成引导
app/me/page.tsx                         # 修改: 整合路径概览
```

---

## Task 1: 数据模型扩展

**文件:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 添加学习路径模型**

在 `prisma/schema.prisma` 的 `User` 模型中，添加学习路径偏好字段：

```prisma
model User {
  // ... 现有字段保持不变 ...

  // 学习路径偏好（新增）
  includeStale      Boolean @default(false)  // 是否包含久未练习的已掌握知识点
  pathUpdateMode    String  @default('auto') // 'auto' | 'manual'
  weeklyReportDay   Int     @default(0)      // 0=周日, 1=周一, ...

  // 关联（新增）
  learningPaths     LearningPath[]
}
```

- [ ] **Step 2: 添加学习路径相关模型**

在 `prisma/schema.prisma` 末尾添加以下模型：

```prisma
// 学习路径
model LearningPath {
  id                String   @id @default(cuid())
  userId            String
  name              String   // "2024秋季学期学习路径"
  type              String   // 'initial' | 'weekly' | 'manual'
  status            String   @default('active') // active/archived
  knowledgeData     String   @default("[]") // JSON字符串: [{nodeId, priority, status, addedAt, reasons}]
  generatedAt       DateTime @default(now())
  expiresAt         DateTime? // 周路径的过期时间

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  adjustments       PathAdjustment[]
  weeklyReports     WeeklyReport[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId, status])
}

// 路径调整记录
model PathAdjustment {
  id                String   @id @default(cuid())
  pathId            String
  type              String   // 'micro' | 'weekly'
  trigger           String   // 'practice_completed' | 'weekly_recalibration'
  changes           String   @default("{}") // JSON字符串: {added: [], removed: [], reordered: []}
  createdAt         DateTime @default(now())

  path              LearningPath @relation(fields: [pathId], references: [id], onDelete: Cascade)

  @@index([pathId, createdAt])
}

// 周报
model WeeklyReport {
  id                String   @id @default(cuid())
  pathId            String
  weekStart         DateTime
  weekEnd           DateTime
  summary           String   @default("{}") // JSON字符串: {practicedCount, masteredCount, weakCount}
  staleKnowledge    String   @default("[]") // JSON字符串: [{nodeId, lastPractice, mastery}]
  recommendations   String   @default("{}") // JSON字符串: {toReview: [], toLearn: []}
  viewed           Boolean  @default(false)

  path              LearningPath @relation(fields: [pathId], references: [id], onDelete: Cascade)

  createdAt         DateTime @default(now())

  @@index([pathId, weekStart])
}
```

- [ ] **Step 3: 推送数据库变更**

```bash
npx prisma db push
```

预期输出: 数据库schema更新成功

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add learning path data models"
```

---

## Task 2: 类型定义和工具函数

**文件:**
- Create: `lib/learning-path/types.ts`
- Create: `lib/learning-path/types.test.ts`

- [ ] **Step 1: 编写类型测试**

创建 `lib/learning-path/types.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import {
  PathKnowledgeNodeSchema,
  PriorityFactorsInput,
  PathAdjustmentChangesSchema,
  WeeklyReportSummarySchema,
  WeeklyReportStaleItemSchema,
  WeeklyReportRecommendationsSchema
} from './types';

describe('LearningPathTypes', () => {
  describe('PathKnowledgeNodeSchema', () => {
    it('should validate a valid knowledge node', () => {
      const input = {
        nodeId: 'kp123',
        priority: 8.5,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: ['权重高', '测评正确率低']
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const input = {
        nodeId: 'kp123',
        priority: 8.5,
        status: 'invalid',
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative priority', () => {
      const input = {
        nodeId: 'kp123',
        priority: -1,
        status: 'pending' as const,
        addedAt: new Date().toISOString(),
        reasons: []
      };

      const result = PathKnowledgeNodeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('PathAdjustmentChangesSchema', () => {
    it('should validate adjustment changes', () => {
      const input = {
        added: ['kp1', 'kp2'],
        removed: ['kp3'],
        reordered: [{ nodeId: 'kp1', oldPriority: 5, newPriority: 8 }]
      };

      const result = PathAdjustmentChangesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('WeeklyReportSummarySchema', () => {
    it('should validate weekly summary', () => {
      const input = {
        practicedCount: 10,
        masteredCount: 3,
        weakCount: 2
      };

      const result = WeeklyReportSummarySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('WeeklyReportStaleItemSchema', () => {
    it('should validate stale knowledge item', () => {
      const input = {
        nodeId: 'kp123',
        name: '勾股定理',
        lastPractice: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        mastery: 0.85
      };

      const result = WeeklyReportStaleItemSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('WeeklyReportRecommendationsSchema', () => {
    it('should validate recommendations', () => {
      const input = {
        toReview: ['kp1', 'kp2'],
        toLearn: ['kp3', 'kp4', 'kp5']
      };

      const result = WeeklyReportRecommendationsSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- lib/learning-path/types.test.ts
```

预期: 失败，因为文件还不存在

- [ ] **Step 3: 创建类型定义文件**

创建 `lib/learning-path/types.ts`:

```typescript
import { z } from 'zod';

// 知识点路径节点状态
export const PathNodeStatusSchema = z.enum(['pending', 'learning', 'mastered', 'stale']);
export type PathNodeStatus = z.infer<typeof PathNodeStatusSchema>;

// 单个知识点路径节点
export const PathKnowledgeNodeSchema = z.object({
  nodeId: z.string(),
  priority: z.number().min(0),
  status: PathNodeStatusSchema,
  addedAt: z.string(), // ISO 8601 日期字符串
  reasons: z.array(z.string())
});
export type PathKnowledgeNode = z.infer<typeof PathKnowledgeNodeSchema>;

// 优先级计算输入因子
export interface PriorityFactorsInput {
  mastery: number;           // 0-1
  weight: number;            // 1-5
  daysSincePractice: number;
  recentFailureRate: number; // 0-1
  includeStale: boolean;
}

// 优先级计算结果
export interface PriorityResult {
  score: number;
  breakdown: {
    baseScore: number;
    failureBonus: number;
    stalePenalty: number;
  };
}

// 路径调整变更
export const PathAdjustmentChangesSchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  reordered: z.array(z.object({
    nodeId: z.string(),
    oldPriority: z.number(),
    newPriority: z.number()
  }))
});
export type PathAdjustmentChanges = z.infer<typeof PathAdjustmentChangesSchema>;

// 路径类型
export const PathTypeSchema = z.enum(['initial', 'weekly', 'manual']);
export type PathType = z.infer<typeof PathTypeSchema>;

// 路径调整类型
export const AdjustmentTypeSchema = z.enum(['micro', 'weekly']);
export type AdjustmentType = z.infer<typeof AdjustmentTypeSchema>;

// 路径触发类型
export const AdjustmentTriggerSchema = z.enum(['practice_completed', 'weekly_recalibration', 'manual']);
export type AdjustmentTrigger = z.infer<typeof AdjustmentTriggerSchema>;

// 周报摘要
export const WeeklyReportSummarySchema = z.object({
  practicedCount: z.number().int().min(0),
  masteredCount: z.number().int().min(0),
  weakCount: z.number().int().min(0)
});
export type WeeklyReportSummary = z.infer<typeof WeeklyReportSummarySchema>;

// 周报stale知识点
export const WeeklyReportStaleItemSchema = z.object({
  nodeId: z.string(),
  name: z.string(),
  lastPractice: z.string(), // ISO 8601
  mastery: z.number().min(0).max(1)
});
export type WeeklyReportStaleItem = z.infer<typeof WeeklyReportStaleItemSchema>;

// 周报推荐
export const WeeklyReportRecommendationsSchema = z.object({
  toReview: z.array(z.string()),
  toLearn: z.array(z.string())
});
export type WeeklyReportRecommendations = z.infer<typeof WeeklyReportRecommendationsSchema>;

// 路径生成请求
export const GeneratePathRequestSchema = z.object({
  assessmentId: z.string().optional(),
  userEdits: z.object({
    add: z.array(z.string()),
    remove: z.array(z.string())
  }).optional()
});
export type GeneratePathRequest = z.infer<typeof GeneratePathRequestSchema>;

// 路径查询响应
export interface PathQueryResponse {
  path: {
    id: string;
    name: string;
    status: string;
    currentIndex: number;
  };
  roadmap: Array<{
    nodeId: string;
    name: string;
    status: 'completed' | 'current' | 'pending';
    mastery: number;
    priority: number;
  }>;
  weeklySummary: {
    practicedCount: number;
    masteredCount: number;
    weakCount: number;
  };
}

// API响应包装
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- lib/learning-path/types.test.ts
```

预期: 全部通过

- [ ] **Step 5: 提交**

```bash
git add lib/learning-path/types.ts lib/learning-path/types.test.ts
git commit -m "feat: add learning path type definitions with tests"
```

---

## Task 3: 优先级计算逻辑

**文件:**
- Create: `lib/learning-path/priority.ts`
- Create: `lib/learning-path/priority.test.ts`

- [ ] **Step 1: 编写优先级计算测试**

创建 `lib/learning-path/priority.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { calculatePriority, generatePriorityReasons } from './priority';
import type { PriorityFactorsInput } from './types';

describe('calculatePriority', () => {
  it('should calculate base priority correctly', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0,
      includeStale: false
    };

    const result = calculatePriority(input);

    // baseScore = 3 * (1 - 0.5) = 1.5
    // failureBonus = 1.0 (no recent failures)
    // stalePenalty = 1.0 (not stale)
    // total = 1.5 * 1.0 * 1.0 = 1.5
    expect(result.score).toBe(1.5);
    expect(result.breakdown.baseScore).toBe(1.5);
    expect(result.breakdown.failureBonus).toBe(1.0);
    expect(result.breakdown.stalePenalty).toBe(1.0);
  });

  it('should apply failure bonus for high recent failure rate', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0.6, // > 0.5
      includeStale: false
    };

    const result = calculatePriority(input);

    // baseScore = 1.5, failureBonus = 1.5
    expect(result.score).toBe(2.25);
    expect(result.breakdown.failureBonus).toBe(1.5);
  });

  it('should apply stale penalty when not including stale and days > 14', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 15,
      recentFailureRate: 0,
      includeStale: false // 用户不包含stale
    };

    const result = calculatePriority(input);

    // baseScore = 3 * (1 - 0.8) = 0.6
    // stalePenalty = 0.5 (stale且不包含)
    expect(result.breakdown.stalePenalty).toBe(0.5);
  });

  it('should not apply stale penalty when includeStale is true', () => {
    const input: PriorityFactorsInput = {
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 15,
      recentFailureRate: 0,
      includeStale: true // 用户选择包含stale
    };

    const result = calculatePriority(input);

    // stalePenalty = 1 (用户选择包含)
    expect(result.breakdown.stalePenalty).toBe(1.0);
  });

  it('should return zero priority for fully mastered with no issues', () => {
    const input: PriorityFactorsInput = {
      mastery: 1.0,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0,
      includeStale: false
    };

    const result = calculatePriority(input);

    expect(result.score).toBe(0);
  });
});

describe('generatePriorityReasons', () => {
  it('should generate reasons for high weight weak knowledge', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.2,
      weight: 5,
      daysSincePractice: 2,
      recentFailureRate: 0.6,
      includeStale: false
    });

    expect(reasons).toContain('权重高(5)');
    expect(reasons).toContain('测评正确率低');
    expect(reasons).toContain('最近错误率高');
  });

  it('should generate stale reason', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.8,
      weight: 3,
      daysSincePractice: 16,
      recentFailureRate: 0,
      includeStale: false
    });

    expect(reasons).toContain('久未练习(16天)');
  });

  it('should return minimal reasons for average knowledge', () => {
    const reasons = generatePriorityReasons({
      mastery: 0.5,
      weight: 3,
      daysSincePractice: 5,
      recentFailureRate: 0.3,
      includeStale: false
    });

    expect(reasons.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- lib/learning-path/priority.test.ts
```

预期: 失败，文件不存在

- [ ] **Step 3: 实现优先级计算**

创建 `lib/learning-path/priority.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import type { PriorityFactorsInput, PriorityResult } from './types';

const STALE_DAYS_THRESHOLD = 14;
const HIGH_FAILURE_RATE_THRESHOLD = 0.5;
const FAILURE_BONUS_MULTIPLIER = 1.5;
const STALE_PENALTY_MULTIPLIER = 0.5;

/**
 * 计算知识点优先级
 *
 * 公式: 基础分 × 失败加成 × 遗忘惩罚
 * - 基础分 = 权重 × (1 - 掌握度)
 * - 失败加成 = 1.5 (最近错误率 > 50%) | 1.0
 * - 遗忘惩罚 = 0.5 (stale且不包含) | 1.0
 */
export function calculatePriority(input: PriorityFactorsInput): PriorityResult {
  const { mastery, weight, daysSincePractice, recentFailureRate, includeStale } = input;

  // 基础优先级 = 权重 × (1 - 掌握度)
  const baseScore = weight * (1 - mastery);

  // 最近失败加成
  const failureBonus = recentFailureRate > HIGH_FAILURE_RATE_THRESHOLD
    ? FAILURE_BONUS_MULTIPLIER
    : 1.0;

  // 遗忘惩罚（可选，用户控制）
  let stalePenalty = 1.0;
  if (!includeStale && daysSincePractice > STALE_DAYS_THRESHOLD) {
    stalePenalty = STALE_PENALTY_MULTIPLIER;
  }

  const score = baseScore * failureBonus * stalePenalty;

  return {
    score: Math.max(0, score), // 确保非负
    breakdown: {
      baseScore,
      failureBonus,
      stalePenalty
    }
  };
}

/**
 * 生成优先级原因说明
 */
export function generatePriorityReasons(input: PriorityFactorsInput): string[] {
  const reasons: string[] = [];
  const { mastery, weight, daysSincePractice, recentFailureRate } = input;

  // 权重说明
  if (weight >= 4) {
    reasons.push(`权重高(${weight})`);
  } else if (weight <= 2) {
    reasons.push(`权重低(${weight})`);
  }

  // 掌握度说明
  if (mastery < 0.3) {
    reasons.push('测评正确率低');
  } else if (mastery > 0.8) {
    reasons.push('基本掌握');
  }

  // 最近失败率说明
  if (recentFailureRate > HIGH_FAILURE_RATE_THRESHOLD) {
    reasons.push('最近错误率高');
  }

  // 遗忘说明
  if (daysSincePractice > STALE_DAYS_THRESHOLD) {
    reasons.push(`久未练习(${daysSincePractice}天)`);
  }

  return reasons.length > 0 ? reasons : ['常规学习'];
}

/**
 * 获取用户对知识点的掌握度
 */
export async function getUserMastery(userId: string, knowledgePointId: string): Promise<number> {
  // 先从UserKnowledge表查找
  const userKnowledge = await prisma.userKnowledge.findUnique({
    where: {
      userId_knowledgePoint: {
        userId,
        knowledgePoint: knowledgePointId
      }
    }
  });

  if (userKnowledge) {
    return userKnowledge.mastery;
  }

  // 如果没有记录，从Assessment的knowledgeData中查找
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    take: 1
  });

  if (latestAssessment) {
    try {
      const knowledgeData = JSON.parse(latestAssessment.knowledgeData as string);
      const kpData = knowledgeData[knowledgePointId];
      if (kpData && kpData.mastery !== undefined) {
        return kpData.mastery;
      }
    } catch {
      // 解析失败，返回默认值
    }
  }

  return 0; // 默认未掌握
}

/**
 * 计算距离上次练习的天数
 */
export async function getDaysSincePractice(userId: string, knowledgePointId: string): Promise<number> {
  const userKnowledge = await prisma.userKnowledge.findUnique({
    where: {
      userId_knowledgePoint: {
        userId,
        knowledgePoint: knowledgePointId
      }
    }
  });

  if (!userKnowledge) {
    return 999; // 从未练习，返回大数值
  }

  const now = new Date();
  const lastPractice = new Date(userKnowledge.lastPractice);
  const diffMs = now.getTime() - lastPractice.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 获取最近N天的失败率
 */
export async function getRecentFailureRate(
  userId: string,
  knowledgePointId: string,
  days: number
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // 查找最近的练习步骤
  const recentSteps = await prisma.attemptStep.findMany({
    where: {
      attempt: {
        userId
      }
    },
    include: {
      attempt: {
        include: {
          // 通过questionStep关联question，再找knowledgePoints
          questionStep: {
            include: {
              question: true
            }
          }
        }
      }
    }
  });

  // 过滤出该知识点的练习
  let relevantCount = 0;
  let failureCount = 0;

  for (const step of recentSteps) {
    if (step.submittedAt < since) continue;

    try {
      if (step.questionStep?.question) {
        const knowledgePoints = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
        if (knowledgePoints.includes(knowledgePointId)) {
          relevantCount++;
          if (!step.isCorrect) {
            failureCount++;
          }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }

  if (relevantCount === 0) {
    return 0;
  }

  return failureCount / relevantCount;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- lib/learning-path/priority.test.ts
```

预期: 全部通过

- [ ] **Step 5: 提交**

```bash
git add lib/learning-path/priority.ts lib/learning-path/priority.test.ts
git commit -m "feat: implement priority calculation logic"
```

---

## Task 4: 路径生成API

**文件:**
- Create: `app/api/learning-path/generate/route.ts`
- Create: `app/api/learning-path/generate/route.test.ts`

- [ ] **Step 1: 编写API测试**

创建 `app/api/learning-path/generate/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { POST } from './route';
import { prisma } from '@/lib/prisma';

describe('POST /api/learning-path/generate', () => {
  let testUserId: string;
  let testAssessmentId: string;

  beforeAll(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: 'test-path-gen@example.com',
        password: 'hashed',
        grade: 7,
        initialAssessmentCompleted: true,
        initialAssessmentScore: 75
      }
    });
    testUserId = user.id;

    // 创建测试测评记录
    const assessment = await prisma.assessment.create({
      data: {
        userId: testUserId,
        type: 'initial',
        score: 75,
        scoreRangeLow: 70,
        scoreRangeHigh: 80,
        knowledgeData: JSON.stringify({
          'kp1': { level: 1, mastery: 0.3, correctCount: 1, totalCount: 3 },
          'kp2': { level: 1, mastery: 0.6, correctCount: 2, totalCount: 3 }
        })
      }
    });
    testAssessmentId = assessment.id;
  });

  afterAll(async () => {
    await prisma.assessment.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it('should require authentication', async () => {
    const request = new Request('http://localhost:3000/api/learning-path/generate', {
      method: 'POST'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('未登录');
  });

  it('should generate learning path from assessment', async () => {
    // 模拟认证会话
    const request = new Request('http://localhost:3000/api/learning-path/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=mock-${testUserId}`
      },
      body: JSON.stringify({ assessmentId: testAssessmentId })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.pathId).toBeDefined();
    expect(data.data.knowledgeData).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- app/api/learning-path/generate/route.test.ts
```

预期: 失败，API不存在

- [ ] **Step 3: 实现路径生成API**

创建 `app/api/learning-path/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculatePriority, generatePriorityReasons, getUserMastery } from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

/**
 * POST /api/learning-path/generate
 *
 * 根据测评结果生成学习路径
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { assessmentId, userEdits } = body;

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        grade: true,
        initialAssessmentScore: true,
        includeStale: true,
        selectedTextbookId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证测评分数范围 (60-89分才生成路径)
    const assessmentScore = user.initialAssessmentScore ?? 0;
    if (assessmentScore < 60 || assessmentScore >= 90) {
      return NextResponse.json(
        {
          success: false,
          error: assessmentScore < 60
            ? '测评分数偏低，建议降低难度重新测评'
            : '测评分数优秀，建议提高难度重新测评'
        },
        { status: 400 }
      );
    }

    // 获取测评数据
    let assessmentKnowledgeData: Record<string, any> = {};
    if (assessmentId) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId }
      });

      if (assessment && assessment.userId === user.id) {
        try {
          assessmentKnowledgeData = JSON.parse(assessment.knowledgeData as string);
        } catch {
          console.error('Failed to parse assessment knowledgeData');
        }
      }
    }

    // 获取用户启用的知识点
    const enabledKnowledge = await prisma.userEnabledKnowledge.findMany({
      where: {
        userId: user.id,
        nodeType: 'point'
      },
      select: { nodeId: true }
    });

    const enabledKnowledgeIds = new Set(enabledKnowledge.map(e => e.nodeId));

    // 获取教材的知识点
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        ...(user.selectedTextbookId ? {
          chapter: {
            textbookId: user.selectedTextbookId
          }
        } : {})
      },
      include: {
        concept: true,
        chapter: true
      }
    });

    // 计算每个知识点的优先级
    const knowledgeNodes: PathKnowledgeNode[] = [];

    for (const kp of knowledgePoints) {
      // 只处理用户启用的知识点
      if (enabledKnowledgeIds.size > 0 && !enabledKnowledgeIds.has(kp.id)) {
        continue;
      }

      // 获取掌握度
      let mastery = 0;
      if (assessmentKnowledgeData[kp.id]) {
        mastery = assessmentKnowledgeData[kp.id].mastery ?? 0;
      } else {
        mastery = await getUserMastery(user.id, kp.id);
      }

      // 跳过已掌握的知识点
      if (mastery >= 0.9) {
        continue;
      }

      // 计算优先级
      const priorityResult = calculatePriority({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice: 0, // 新路径，假设最近练习过
        recentFailureRate: mastery < 0.5 ? 0.6 : 0, // 低掌握度假设高失败率
        includeStale: user.includeStale
      });

      const reasons = generatePriorityReasons({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice: 0,
        recentFailureRate: mastery < 0.5 ? 0.6 : 0,
        includeStale: user.includeStale
      });

      knowledgeNodes.push({
        nodeId: kp.id,
        priority: priorityResult.score,
        status: 'pending',
        addedAt: new Date().toISOString(),
        reasons
      });
    }

    // 应用用户编辑
    if (userEdits) {
      if (userEdits.add) {
        // 添加额外知识点
        for (const nodeId of userEdits.add) {
          if (!knowledgeNodes.find(n => n.nodeId === nodeId)) {
            const kp = knowledgePoints.find(k => k.id === nodeId);
            if (kp) {
              knowledgeNodes.push({
                nodeId,
                priority: 3, // 默认中等优先级
                status: 'pending',
                addedAt: new Date().toISOString(),
                reasons: ['用户手动添加']
              });
            }
          }
        }
      }

      if (userEdits.remove) {
        // 移除知识点
        const removeSet = new Set(userEdits.remove);
        knowledgeNodes.splice(0, knowledgeNodes.length,
          ...knowledgeNodes.filter(n => !removeSet.has(n.nodeId))
        );
      }
    }

    // 按优先级排序
    knowledgeNodes.sort((a, b) => b.priority - a.priority);

    // 创建学习路径记录
    const path = await prisma.learningPath.create({
      data: {
        userId: user.id,
        name: `${new Date().getFullYear()}年学习路径`,
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify(knowledgeNodes)
      }
    });

    // 归档旧路径
    await prisma.learningPath.updateMany({
      where: {
        userId: user.id,
        id: { not: path.id },
        status: 'active'
      },
      data: {
        status: 'archived'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        pathId: path.id,
        knowledgeData: knowledgeNodes
      }
    });

  } catch (error) {
    console.error('生成学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '生成失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- app/api/learning-path/generate/route.test.ts
```

预期: 通过

- [ ] **Step 5: 提交**

```bash
git add app/api/learning-path/generate/route.ts app/api/learning-path/generate/route.test.ts
git commit -m "feat: add learning path generation API"
```

---

## Task 5: 路径查询API

**文件:**
- Create: `app/api/learning-path/route.ts`
- Create: `app/api/learning-path/route.test.ts`

- [ ] **Step 1: 编写测试**

创建 `app/api/learning-path/route.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GET } from './route';
import { prisma } from '@/lib/prisma';

describe('GET /api/learning-path', () => {
  let testUserId: string;
  let testPathId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-path-query@example.com',
        password: 'hashed',
        grade: 7
      }
    });
    testUserId = user.id;

    const path = await prisma.learningPath.create({
      data: {
        userId: testUserId,
        name: '测试路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 8, status: 'pending', addedAt: new Date().toISOString(), reasons: ['测试'] },
          { nodeId: 'kp2', priority: 5, status: 'learning', addedAt: new Date().toISOString(), reasons: ['测试'] }
        ])
      }
    });
    testPathId = path.id;
  });

  afterAll(async () => {
    await prisma.learningPath.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it('should return active learning path', async () => {
    const request = new Request('http://localhost:3000/api/learning-path', {
      headers: {
        'Cookie': `next-auth.session-token=mock-${testUserId}`
      }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.path.id).toBe(testPathId);
    expect(data.data.roadmap).toBeInstanceOf(Array);
  });

  it('should return 404 if no active path exists', async () => {
    // 删除测试路径
    await prisma.learningPath.delete({ where: { id: testPathId } });

    const request = new Request('http://localhost:3000/api/learning-path', {
      headers: {
        'Cookie': `next-auth.session-token=mock-${testUserId}`
      }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('没有找到活跃的学习路径');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- app/api/learning-path/route.test.ts
```

预期: 失败

- [ ] **Step 3: 实现路径查询API**

创建 `app/api/learning-path/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMastery } from '@/lib/learning-path/priority';

/**
 * GET /api/learning-path
 *
 * 获取用户的活跃学习路径
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 获取活跃路径
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    if (!path) {
      return NextResponse.json(
        { success: false, error: '没有找到活跃的学习路径，请先完成测评' },
        { status: 404 }
      );
    }

    // 解析知识点数据
    const knowledgeNodes: Array<{
      nodeId: string;
      priority: number;
      status: string;
      addedAt: string;
      reasons: string[];
    }> = JSON.parse(path.knowledgeData);

    // 获取知识点详细信息并计算当前状态
    const roadmap = [];
    let currentIndex = 0;

    for (let i = 0; i < knowledgeNodes.length; i++) {
      const node = knowledgeNodes[i];
      const mastery = await getUserMastery(session.user.id, node.nodeId);

      // 更新状态
      let status: 'completed' | 'current' | 'pending' = 'pending';
      if (mastery >= 0.8) {
        status = 'completed';
      } else if (mastery > 0 && i === currentIndex) {
        status = 'current';
        currentIndex = i;
      } else if (mastery > 0 && status === 'pending') {
        status = 'current';
        currentIndex = i;
      }

      // 获取知识点名称
      const kp = await prisma.knowledgePoint.findUnique({
        where: { id: node.nodeId },
        include: { concept: true }
      });

      roadmap.push({
        nodeId: node.nodeId,
        name: kp?.name || kp?.concept?.name || node.nodeId,
        status,
        mastery,
        priority: node.priority
      });
    }

    // 计算本周统计
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const weeklyAttempts = await prisma.attempt.count({
      where: {
        userId: session.user.id,
        startedAt: { gte: weekStart }
      }
    });

    const masteredThisWeek = await prisma.userKnowledge.count({
      where: {
        userId: session.user.id,
        mastery: { gte: 0.8 },
        lastPractice: { gte: weekStart }
      }
    });

    const weakCount = knowledgeNodes.filter(n => n.status === 'pending').length;

    return NextResponse.json({
      success: true,
      data: {
        path: {
          id: path.id,
          name: path.name,
          status: path.status,
          currentIndex
        },
        roadmap,
        weeklySummary: {
          practicedCount: weeklyAttempts,
          masteredCount: masteredThisWeek,
          weakCount
        }
      }
    });

  } catch (error) {
    console.error('查询学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- app/api/learning-path/route.test.ts
```

预期: 通过

- [ ] **Step 5: 提交**

```bash
git add app/api/learning-path/route.ts app/api/learning-path/route.test.ts
git commit -m "feat: add learning path query API"
```

---

## Task 6: 微调API

**文件:**
- Create: `lib/learning-path/adapter.ts`
- Create: `lib/learning-path/adapter.test.ts`
- Create: `app/api/learning-path/adjust/route.ts`

- [ ] **Step 1: 编写微调逻辑测试**

创建 `lib/learning-path/adapter.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { calculateMicroAdjustments } from './adapter';

describe('calculateMicroAdjustments', () => {
  it('should decrease priority for correct answers', () => {
    const nodes = [
      { nodeId: 'kp1', priority: 8, status: 'pending' as const, addedAt: new Date().toISOString(), reasons: [] },
      { nodeId: 'kp2', priority: 5, status: 'pending' as const, addedAt: new Date().toISOString(), reasons: [] }
    ];

    const result = calculateMicroAdjustments(nodes, [
      { knowledgePointId: 'kp1', isCorrect: true }
    ]);

    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].nodeId).toBe('kp1');
    expect(result.adjustments[0].newPriority).toBeLessThan(8);
    expect(result.adjustments[0].reason).toContain('回答正确');
  });

  it('should increase priority for incorrect answers', () => {
    const nodes = [
      { nodeId: 'kp1', priority: 5, status: 'pending' as const, addedAt: new Date().toISOString(), reasons: [] }
    ];

    const result = calculateMicroAdjustments(nodes, [
      { knowledgePointId: 'kp1', isCorrect: false }
    ]);

    expect(result.adjustments[0].newPriority).toBeGreaterThan(5);
    expect(result.adjustments[0].reason).toContain('回答错误');
  });

  it('should adjust related chapter nodes slightly', () => {
    const nodes = [
      { nodeId: 'kp1', priority: 8, status: 'pending' as const, addedAt: new Date().toISOString(), reasons: [] },
      { nodeId: 'kp2', priority: 5, status: 'pending' as const, addedAt: new Date().toISOString(), reasons: [] }
    ];

    const result = calculateMicroAdjustments(nodes, [
      { knowledgePointId: 'kp1', isCorrect: true }
    ]);

    // kp2 应该有轻微调整（相同章节假设）
    const kp2Adjustment = result.adjustments.find(a => a.nodeId === 'kp2');
    expect(kp2Adjustment).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- lib/learning-path/adapter.test.ts
```

预期: 失败

- [ ] **Step 3: 实现微调逻辑**

创建 `lib/learning-path/adapter.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import type { PathKnowledgeNode } from './types';

const PRIORITY_DECREASE_CORRECT = 0.2; // 正确降低20%
const PRIORITY_INCREASE_WRONG = 0.3;   // 错误增加30%
const RELATED_ADJUSTMENT = 0.05;        // 相关节点调整5%

export interface PracticeResult {
  knowledgePointId: string;
  isCorrect: boolean;
}

export interface MicroAdjustmentResult {
  adjustments: Array<{
    nodeId: string;
    oldPriority: number;
    newPriority: number;
    reason: string;
  }>;
  nextRecommendation?: {
    nodeId: string;
    priority: number;
  };
}

/**
 * 计算练习后的微调
 *
 * 规则:
 * - 回答正确 → 优先级下降20%
 * - 回答错误 → 优先级上升30%
 * - 同章节其他知识点 → 微调±5%
 */
export function calculateMicroAdjustments(
  nodes: PathKnowledgeNode[],
  practiceResults: PracticeResult[]
): MicroAdjustmentResult {
  const adjustments: MicroAdjustmentResult['adjustments'] = [];
  const adjustedNodes = new Map<string, number>();

  // 处理每个练习结果
  for (const result of practiceResults) {
    const node = nodes.find(n => n.nodeId === result.knowledgePointId);
    if (!node) continue;

    let newPriority = node.priority;
    let reason = '';

    if (result.isCorrect) {
      newPriority = node.priority * (1 - PRIORITY_DECREASE_CORRECT);
      reason = '回答正确，优先级下降';
    } else {
      newPriority = node.priority * (1 + PRIORITY_INCREASE_WRONG);
      reason = '回答错误，优先级上升';
    }

    adjustedNodes.set(node.nodeId, newPriority);
    adjustments.push({
      nodeId: node.nodeId,
      oldPriority: node.priority,
      newPriority,
      reason
    });
  }

  // 对同章节其他知识点进行微调（这里简化处理，实际需要查询章节关系）
  // 获取相关知识点ID
  const relatedNodeIds = new Set<string>();
  for (const result of practiceResults) {
    const directlyAdjusted = Array.from(adjustedNodes.keys());
    for (const node of nodes) {
      if (!directlyAdjusted.includes(node.nodeId) && !relatedNodeIds.has(node.nodeId)) {
        // 简化：假设其他都是相关节点
        relatedNodeIds.add(node.nodeId);
      }
    }
  }

  // 对相关节点进行微调
  for (const nodeId of relatedNodeIds) {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node || adjustedNodes.has(nodeId)) continue;

    // 根据练习结果决定方向（有正确则微降，有错误则微升）
    const hasCorrect = practiceResults.some(r => r.isCorrect);
    const adjustment = hasCorrect ? -RELATED_ADJUSTMENT : RELATED_ADJUSTMENT;

    const newPriority = Math.max(0, node.priority + adjustment);
    adjustedNodes.set(nodeId, newPriority);

    adjustments.push({
      nodeId,
      oldPriority: node.priority,
      newPriority,
      reason: hasCorrect ? '相关知识点进步' : '相关知识点需关注'
    });
  }

  // 找出下一个最高优先级的学习点
  let nextRecommendation: MicroAdjustmentResult['nextRecommendation'] | undefined;
  const adjustedEntries = Array.from(adjustedNodes.entries());
  if (adjustedEntries.length > 0) {
    const [highestNodeId, highestPriority] = adjustedEntries.reduce((a, b) =>
      b[1] > a[1] ? b : a
    );
    nextRecommendation = {
      nodeId: highestNodeId,
      priority: highestPriority
    };
  }

  return { adjustments, nextRecommendation };
}

/**
 * 应用微调到数据库
 */
export async function applyMicroAdjustments(
  pathId: string,
  adjustments: MicroAdjustmentResult['adjustments']
): Promise<void> {
  // 获取当前路径数据
  const path = await prisma.learningPath.findUnique({
    where: { id: pathId }
  });

  if (!path) {
    throw new Error('路径不存在');
  }

  const nodes: PathKnowledgeNode[] = JSON.parse(path.knowledgeData);

  // 应用调整
  const adjustmentMap = new Map(adjustments.map(a => [a.nodeId, a.newPriority]));
  for (const node of nodes) {
    if (adjustmentMap.has(node.nodeId)) {
      node.priority = adjustmentMap.get(node.nodeId)!;
    }
  }

  // 按新优先级排序
  nodes.sort((a, b) => b.priority - a.priority);

  // 更新数据库
  await prisma.learningPath.update({
    where: { id: pathId },
    data: {
      knowledgeData: JSON.stringify(nodes)
    }
  });

  // 记录调整历史
  await prisma.pathAdjustment.create({
    data: {
      pathId,
      type: 'micro',
      trigger: 'practice_completed',
      changes: JSON.stringify({
        reordered: adjustments.map(a => ({
          nodeId: a.nodeId,
          oldPriority: a.oldPriority,
          newPriority: a.newPriority
        }))
      })
    }
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- lib/learning-path/adapter.test.ts
```

预期: 通过

- [ ] **Step 5: 创建微调API**

创建 `app/api/learning-path/adjust/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateMicroAdjustments, applyMicroAdjustments } from '@/lib/learning-path/adapter';

/**
 * POST /api/learning-path/adjust
 *
 * 练习完成后微调学习路径
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { attemptId, practiceResults } = body;

    if (!practiceResults || !Array.isArray(practiceResults)) {
      return NextResponse.json(
        { success: false, error: '参数错误' },
        { status: 400 }
      );
    }

    // 获取活跃路径
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    if (!path) {
      return NextResponse.json(
        { success: false, error: '没有活跃的学习路径' },
        { status: 404 }
      );
    }

    // 解析当前知识点
    const nodes = JSON.parse(path.knowledgeData);

    // 计算微调
    const result = calculateMicroAdjustments(nodes, practiceResults);

    // 应用到数据库
    await applyMicroAdjustments(path.id, result.adjustments);

    // 获取下一个推荐的知识点名称
    let nextRecommendationName = '';
    if (result.nextRecommendation) {
      const kp = await prisma.knowledgePoint.findUnique({
        where: { id: result.nextRecommendation.nodeId },
        include: { concept: true }
      });
      nextRecommendationName = kp?.name || kp?.concept?.name || '';
    }

    return NextResponse.json({
      success: true,
      data: {
        adjustments: result.adjustments,
        nextRecommendation: result.nextRecommendation ? {
          nodeId: result.nextRecommendation.nodeId,
          name: nextRecommendationName
        } : null
      }
    });

  } catch (error) {
    console.error('微调学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '微调失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: 提交**

```bash
git add lib/learning-path/adapter.ts lib/learning-path/adapter.test.ts app/api/learning-path/adjust/route.ts
git commit -m "feat: add micro-adjustment logic and API"
```

---

## Task 7: 周报API

**文件:**
- Create: `app/api/learning-path/weekly-report/route.ts`
- Create: `app/api/learning-path/recalibrate/route.ts`

- [ ] **Step 1: 创建周报查询API**

创建 `app/api/learning-path/weekly-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const STALE_DAYS_THRESHOLD = 14;
const STALE_MASTERY_THRESHOLD = 0.7;

/**
 * GET /api/learning-path/weekly-report
 *
 * 获取本周学习报告
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 计算本周时间范围
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // 获取本周练习记录
    const weeklyAttempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        startedAt: { gte: weekStart }
      },
      include: {
        steps: true
      }
    });

    // 统计练习的知识点
    const practicedKnowledgeIds = new Set<string>();
    for (const attempt of weeklyAttempts) {
      for (const step of attempt.steps) {
        if (step.questionStepId) {
          const qs = await prisma.questionStep.findUnique({
            where: { id: step.questionStepId },
            include: { question: true }
          });
          if (qs?.question) {
            try {
              const kps = JSON.parse(qs.question.knowledgePoints || '[]');
              kps.forEach((kp: string) => practicedKnowledgeIds.add(kp));
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    }

    const practicedCount = practicedKnowledgeIds.size;

    // 统计本周掌握的知识点
    const masteredThisWeek = await prisma.userKnowledge.count({
      where: {
        userId: session.user.id,
        mastery: { gte: 0.8 },
        lastPractice: { gte: weekStart }
      }
    });

    // 获取活跃路径中的薄弱知识点
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    let weakCount = 0;
    let staleKnowledge: Array<{ nodeId: string; name: string; lastPractice: Date; mastery: number }> = [];

    if (path) {
      const nodes = JSON.parse(path.knowledgeData);
      weakCount = nodes.filter((n: any) => n.status === 'pending' || n.status === 'learning').length;

      // 检测stale知识点
      for (const node of nodes) {
        const userKnowledge = await prisma.userKnowledge.findUnique({
          where: {
            userId_knowledgePoint: {
              userId: session.user.id,
              knowledgePoint: node.nodeId
            }
          }
        });

        if (userKnowledge && userKnowledge.mastery >= STALE_MASTERY_THRESHOLD) {
          const daysSince = Math.floor(
            (Date.now() - userKnowledge.lastPractice.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSince > STALE_DAYS_THRESHOLD) {
            const kp = await prisma.knowledgePoint.findUnique({
              where: { id: node.nodeId },
              include: { concept: true }
            });

            staleKnowledge.push({
              nodeId: node.nodeId,
              name: kp?.name || kp?.concept?.name || node.nodeId,
              lastPractice: userKnowledge.lastPractice,
              mastery: userKnowledge.mastery
            });
          }
        }
      }
    }

    // 生成推荐
    const recommendations = {
      toReview: staleKnowledge.map(s => s.nodeId),
      toLearn: [] // 可以根据优先级推荐待学习
    };

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        summary: {
          practicedCount,
          masteredCount: masteredThisWeek,
          weakCount
        },
        staleKnowledge: staleKnowledge.map(s => ({
          ...s,
          lastPractice: s.lastPractice.toISOString()
        })),
        recommendations
      }
    });

  } catch (error) {
    console.error('获取周报错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 创建重组API**

创建 `app/api/learning-path/recalibrate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculatePriority, generatePriorityReasons, getUserMastery } from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

/**
 * POST /api/learning-path/recalibrate
 *
 * 周度重组学习路径
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { includeStale } = body;

    // 获取用户设置
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        includeStale: true,
        selectedTextbookId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 获取活跃路径
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    if (!path) {
      return NextResponse.json(
        { success: false, error: '没有活跃的学习路径' },
        { status: 404 }
      );
    }

    // 获取所有知识点
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        ...(user.selectedTextbookId ? {
          chapter: {
            textbookId: user.selectedTextbookId
          }
        } : {})
      },
      include: {
        concept: true
      }
    });

    // 计算新的优先级
    const newNodes: PathKnowledgeNode[] = [];

    for (const kp of knowledgePoints) {
      const mastery = await getUserMastery(session.user.id, kp.id);

      // 跳过完全掌握且不包含stale的
      if (mastery >= 0.9 && !includeStale && !user.includeStale) {
        continue;
      }

      // 获取练习天数
      const userKnowledge = await prisma.userKnowledge.findUnique({
        where: {
          userId_knowledgePoint: {
            userId: session.user.id,
            knowledgePoint: kp.id
          }
        }
      });

      const daysSincePractice = userKnowledge
        ? Math.floor((Date.now() - userKnowledge.lastPractice.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // 计算最近失败率
      const recentSteps = await prisma.attemptStep.findMany({
        where: {
          attempt: { userId: session.user.id },
          submittedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        },
        take: 50
      });

      let recentFailureRate = 0;
      let relevantCount = 0;
      let failureCount = 0;

      for (const step of recentSteps) {
        if (step.questionStepId) {
          const qs = await prisma.questionStep.findUnique({
            where: { id: step.questionStepId },
            include: { question: true }
          });
          if (qs?.question) {
            try {
              const kps = JSON.parse(qs.question.knowledgePoints || '[]');
              if (kps.includes(kp.id)) {
                relevantCount++;
                if (!step.isCorrect) failureCount++;
              }
            } catch {
              // 忽略
            }
          }
        }
      }

      if (relevantCount > 0) {
        recentFailureRate = failureCount / relevantCount;
      }

      // 计算优先级
      const priorityResult = calculatePriority({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: includeStale ?? user.includeStale
      });

      const reasons = generatePriorityReasons({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: includeStale ?? user.includeStale
      });

      // 确定状态
      let status: 'pending' | 'learning' | 'mastered' | 'stale' = 'pending';
      if (mastery >= 0.9) {
        status = 'mastered';
      } else if (mastery >= 0.5) {
        status = 'learning';
      } else if (daysSincePractice > 14 && mastery >= 0.7) {
        status = 'stale';
      }

      newNodes.push({
        nodeId: kp.id,
        priority: priorityResult.score,
        status,
        addedAt: new Date().toISOString(),
        reasons
      });
    }

    // 按优先级排序
    newNodes.sort((a, b) => b.priority - a.priority);

    // 更新路径
    await prisma.learningPath.update({
      where: { id: path.id },
      data: {
        knowledgeData: JSON.stringify(newNodes),
        updatedAt: new Date()
      }
    });

    // 记录调整
    await prisma.pathAdjustment.create({
      data: {
        pathId: path.id,
        type: 'weekly',
        trigger: 'weekly_recalibration',
        changes: JSON.stringify({
          added: [],
          removed: [],
          reordered: newNodes.map(n => ({ nodeId: n.nodeId, priority: n.priority }))
        })
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        path: {
          id: path.id,
          knowledgeData: newNodes
        }
      }
    });

  } catch (error) {
    console.error('重组学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '重组失败' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/learning-path/weekly-report/route.ts app/api/learning-path/recalibrate/route.ts
git commit -m "feat: add weekly report and recalibrate APIs"
```

---

## Task 8: 路径概览组件

**文件:**
- Create: `components/LearningPathOverview.tsx`

- [ ] **Step 1: 创建路径概览组件**

创建 `components/LearningPathOverview.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from './MaterialIcon';
import { userApi } from '@/lib/api';

interface LearningPath {
  id: string;
  name: string;
  status: string;
  currentIndex: number;
}

interface RoadmapItem {
  nodeId: string;
  name: string;
  status: 'completed' | 'current' | 'pending';
  mastery: number;
  priority: number;
}

interface WeeklySummary {
  practicedCount: number;
  masteredCount: number;
  weakCount: number;
}

interface LearningPathOverviewProps {
  onEditPath?: () => void;
  onShowWeeklyReport?: () => void;
}

export default function LearningPathOverview({
  onEditPath,
  onShowWeeklyReport
}: LearningPathOverviewProps) {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPath();
  }, []);

  const loadPath = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-path');
      const data = await res.json();

      if (data.success) {
        setPath(data.data.path);
        setRoadmap(data.data.roadmap);
        setWeeklySummary(data.data.weeklySummary);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error('加载学习路径失败:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !path) {
    return (
      <div className="bg-surface-container-low rounded-[2rem] p-6">
        <div className="text-center py-8">
          <p className="text-on-surface-variant mb-4">{error || '没有找到学习路径'}</p>
          <button
            onClick={() => (window.location.href = '/assessment')}
            className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
          >
            开始测评
          </button>
        </div>
      </div>
    );
  }

  const currentItem = roadmap.find(item => item.status === 'current');
  const nextItem = roadmap.find(item => item.status === 'pending');
  const completedCount = roadmap.filter(item => item.status === 'completed').length;
  const totalCount = roadmap.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-surface-container-low rounded-[2rem] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="route" className="text-primary" style={{ fontSize: '22px' }} />
          </div>
          <h3 className="font-bold text-on-surface">学习路径</h3>
        </div>
        <div className="flex gap-2">
          {onEditPath && (
            <button
              onClick={onEditPath}
              className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
              aria-label="编辑路径"
            >
              <MaterialIcon icon="edit" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            </button>
          )}
          {onShowWeeklyReport && (
            <button
              onClick={onShowWeeklyReport}
              className="w-10 h-10 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center transition-colors"
              aria-label="周报"
            >
              <MaterialIcon icon="calendar_today" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
            </button>
          )}
        </div>
      </div>

      {/* 当前状态 */}
      <div className="bg-surface rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-on-surface-variant">当前位置</span>
          <span className="text-sm text-on-surface-variant">
            {completedCount}/{totalCount} 已完成
          </span>
        </div>

        {currentItem && (
          <p className="text-on-surface font-medium mb-2">{currentItem.name}</p>
        )}

        {nextItem && (
          <p className="text-sm text-on-surface-variant">
            下一个: {nextItem.name}
          </p>
        )}

        {/* 进度条 */}
        <div className="mt-3 w-full bg-surface-container rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 本周统计 */}
      {weeklySummary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{weeklySummary.practicedCount}</p>
            <p className="text-xs text-on-surface-variant">本周练习</p>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">{weeklySummary.masteredCount}</p>
            <p className="text-xs text-on-surface-variant">已掌握</p>
          </div>
          <div className="bg-surface rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-warning">{weeklySummary.weakCount}</p>
            <p className="text-xs text-on-surface-variant">待加强</p>
          </div>
        </div>
      )}

      {/* 路径可视化 */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">路径概览</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {roadmap.slice(0, 10).map((item, index) => (
            <div
              key={item.nodeId}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                item.status === 'completed'
                  ? 'bg-success text-on-success'
                  : item.status === 'current'
                  ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {index + 1}
            </div>
          ))}
          {roadmap.length > 10 && (
            <div className="flex-shrink-0 px-2 text-sm text-on-surface-variant">
              +{roadmap.length - 10}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/LearningPathOverview.tsx
git commit -m "feat: add learning path overview component"
```

---

## Task 9: 周报弹窗组件

**文件:**
- Create: `components/WeeklyReportDialog.tsx`

- [ ] **Step 1: 创建周报弹窗组件**

创建 `components/WeeklyReportDialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from './MaterialIcon';

interface WeeklyReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRecalibrate?: (includeStale: boolean) => void;
}

interface StaleKnowledgeItem {
  nodeId: string;
  name: string;
  lastPractice: string;
  mastery: number;
}

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    practicedCount: number;
    masteredCount: number;
    weakCount: number;
  };
  staleKnowledge: StaleKnowledgeItem[];
  recommendations: {
    toReview: string[];
    toLearn: string[];
  };
}

export default function WeeklyReportDialog({
  isOpen,
  onClose,
  onConfirmRecalibrate
}: WeeklyReportDialogProps) {
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalibrating, setRecalibrating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadReport();
    }
  }, [isOpen]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/learning-path/weekly-report');
      const data = await res.json();

      if (data.success) {
        setReportData(data.data);
      }
    } catch (error) {
      console.error('加载周报失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalibrate = async (includeStale: boolean) => {
    setRecalibrating(true);
    try {
      const res = await fetch('/api/learning-path/recalibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeStale })
      });
      const data = await res.json();

      if (data.success) {
        onConfirmRecalibrate?.(includeStale);
        onClose();
      }
    } catch (error) {
      console.error('重组失败:', error);
    } finally {
      setRecalibrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-container-low rounded-[2rem] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="calendar_today" className="text-primary" style={{ fontSize: '22px' }} />
            </div>
            <h3 className="font-bold text-on-surface">本周学习报告</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface hover:bg-surface-container-high flex items-center justify-center"
          >
            <MaterialIcon icon="close" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : reportData ? (
          <>
            {/* 本周统计 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{reportData.summary.practicedCount}</p>
                <p className="text-xs text-on-surface-variant">练习知识点</p>
              </div>
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-success">{reportData.summary.masteredCount}</p>
                <p className="text-xs text-on-surface-variant">已掌握</p>
              </div>
              <div className="bg-surface rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-warning">{reportData.summary.weakCount}</p>
                <p className="text-xs text-on-surface-variant">待加强</p>
              </div>
            </div>

            {/* 久未复习 */}
            {reportData.staleKnowledge.length > 0 && (
              <div className="bg-surface rounded-xl p-4 mb-6">
                <h4 className="font-medium text-on-surface mb-3 flex items-center gap-2">
                  <MaterialIcon icon="history" className="text-warning" style={{ fontSize: '18px' }} />
                  久未复习
                </h4>
                <div className="space-y-2">
                  {reportData.staleKnowledge.map(item => {
                    const daysSince = Math.floor(
                      (Date.now() - new Date(item.lastPractice).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={item.nodeId} className="flex items-center justify-between text-sm">
                        <span className="text-on-surface">{item.name}</span>
                        <span className="text-on-surface-variant">
                          {daysSince}天前 · 掌握度{Math.round(item.mastery * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            {reportData.staleKnowledge.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => handleRecalibrate(true)}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium bg-primary text-on-primary disabled:opacity-50 transition-colors"
                >
                  {recalibrating ? '处理中...' : '加入复习队列并重组路径'}
                </button>
                <button
                  onClick={() => handleRecalibrate(false)}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium bg-surface text-on-surface-variant disabled:opacity-50 transition-colors"
                >
                  仅重组路径（不含复习）
                </button>
                <button
                  onClick={onClose}
                  disabled={recalibrating}
                  className="w-full py-3 rounded-xl font-medium text-on-surface-variant disabled:opacity-50 transition-colors"
                >
                  稍后提醒
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/WeeklyReportDialog.tsx
git commit -m "feat: add weekly report dialog component"
```

---

## Task 10: 整合到测评结果页

**文件:**
- Modify: `app/assessment/result/page.tsx`

- [ ] **Step 1: 添加路径生成引导**

在测评结果页面添加学习路径生成引导。先读取当前文件:

```bash
cat app/assessment/result/page.tsx
```

然后在适当位置添加路径生成引导:

```typescript
// 在文件开头的 import 后添加
import { useState, useEffect } from 'react';
import LearningPathOverview from '@/components/LearningPathOverview';

// 在组件内添加状态
const [showPathGeneration, setShowPathGeneration] = useState(false);
const [pathGenerated, setPathGenerated] = useState(false);

// 在测评结果显示后添加条件判断
{score >= 60 && score < 90 && !pathGenerated && (
  <div className="bg-primary-container rounded-2xl p-6 mt-6">
    <h3 className="font-bold text-on-primary-container mb-2">生成个性化学习路径</h3>
    <p className="text-sm text-on-primary-container/80 mb-4">
      根据您的测评结果，我们可以为您定制专属的学习路径，帮助您高效提升。
    </p>
    <button
      onClick={async () => {
        const res = await fetch('/api/learning-path/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          setPathGenerated(true);
        }
      }}
      className="bg-primary text-on-primary rounded-full py-3 px-6 font-medium"
    >
      生成学习路径
    </button>
  </div>
)}

{pathGenerated && (
  <LearningPathOverview
    onEditPath={() => setShowPathGeneration(true)}
  />
)}
```

- [ ] **Step 2: 提交**

```bash
git add app/assessment/result/page.tsx
git commit -m "feat: add learning path generation prompt to assessment result"
```

---

## Task 11: 整合到"我的"页面

**文件:**
- Modify: `app/me/page.tsx`

- [ ] **Step 1: 添加路径概览**

在"我的"页面添加学习路径概览卡片。读取当前文件:

```bash
cat app/me/page.tsx
```

在适当位置添加组件:

```typescript
// 添加导入
import LearningPathOverview from '@/components/LearningPathOverview';
import WeeklyReportDialog from '@/components/WeeklyReportDialog';

// 在组件内添加状态
const [showWeeklyReport, setShowWeeklyReport] = useState(false);

// 在学习设置卡片后添加路径概览
<LearningPathOverview
  onEditPath={() => {/* 处理编辑 */}}
  onShowWeeklyReport={() => setShowWeeklyReport(true)}
/>

<WeeklyReportDialog
  isOpen={showWeeklyReport}
  onClose={() => setShowWeeklyReport(false)}
  onConfirmRecalibrate={() => {
    // 重新加载数据
  }}
/>
```

- [ ] **Step 2: 提交**

```bash
git add app/me/page.tsx
git commit -m "feat: integrate learning path overview into me page"
```

---

## Task 12: 练习完成自动微调

**文件:**
- Modify: `components/ExercisePage.tsx`

- [ ] **Step 1: 添加练习完成回调**

在练习完成时调用微调API:

```typescript
// 在练习完成处理中添加
const handleFinish = async (result: any) => {
  // ... 现有逻辑 ...

  // 调用微调API
  try {
    const adjustRes = await fetch('/api/learning-path/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: result.attemptId,
        practiceResults: result.stepResults?.map((step: any) => ({
          knowledgePointId: step.knowledgePointId,
          isCorrect: step.isCorrect
        })) || []
      })
    });
    const adjustData = await adjustRes.json();
    if (adjustData.success && adjustData.data.nextRecommendation) {
      console.log('下一个推荐:', adjustData.data.nextRecommendation);
    }
  } catch (error) {
    console.error('微调失败:', error);
  }

  // ... 继续现有逻辑 ...
};
```

- [ ] **Step 2: 提交**

```bash
git add components/ExercisePage.tsx
git commit -m "feat: trigger micro-adjustment after practice completion"
```

---

## Task 13: E2E测试

**文件:**
- Create: `e2e/learning-path.spec.ts`

- [ ] **Step 1: 编写E2E测试**

创建 `e2e/learning-path.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Learning Path', () => {
  test.beforeEach(async ({ page }) => {
    // 登录测试账号
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('should show path generation prompt after assessment', async ({ page }) => {
    // 完成测评
    await page.goto('/assessment');
    await page.waitForSelector('[data-testid="assessment-question"]');

    // 模拟答题
    for (let i = 0; i < 10; i++) {
      await page.fill('input[data-testid="answer-input"]', '42');
      await page.click('button[data-testid="submit-answer"]');
      await page.waitForTimeout(500);
    }

    // 完成测评
    await page.click('button[data-testid="finish-assessment"]');
    await page.waitForURL('/assessment/result');

    // 检查是否显示路径生成引导
    await expect(page.locator('text=生成个性化学习路径')).toBeVisible();
  });

  test('should generate learning path', async ({ page }) => {
    // 调用生成API
    await page.goto('/api/learning-path/generate', {
      method: 'POST'
    });

    // 验证路径创建
    const response = await page.request.get('/api/learning-path');
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.path).toBeDefined();
  });

  test('should display path overview on me page', async ({ page }) => {
    await page.goto('/me');

    // 检查路径概览卡片
    await expect(page.locator('text=学习路径')).toBeVisible();
    await expect(page.locator('[data-testid="path-progress-bar"]')).toBeVisible();
  });

  test('should show weekly report dialog', async ({ page }) => {
    await page.goto('/me');

    // 点击周报按钮
    await page.click('[aria-label="周报"]');

    // 检查弹窗
    await expect(page.locator('text=本周学习报告')).toBeVisible();
  });
});
```

- [ ] **Step 2: 运行E2E测试**

```bash
npx playwright test e2e/learning-path.spec.ts
```

预期: 全部通过

- [ ] **Step 3: 提交**

```bash
git add e2e/learning-path.spec.ts
git commit -m "test: add E2E tests for learning path"
```

---

## Task 14: 最终验证

- [ ] **Step 1: 运行所有测试**

```bash
npm test
npx playwright test
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "chore: final validation and cleanup"
```

---

## 验收标准确认

- [ ] 测评分数60-89分时，引导用户生成学习路径
- [ ] 初始路径按优先级正确排序
- [ ] 练习完成后自动微调相关知识点优先级
- [ ] 周报正确检测stale知识点
- [ ] 用户可选择是否将stale知识点加入复习
- [ ] 路径可视化显示当前位置和下一步
- [ ] 知识树显示路径状态标记

---

## 完成

实施完成后，系统将具备:
1. 基于测评的自适应路径生成
2. 练习后自动微调
3. 周度复习报告
4. 可视化路径展示
