# Academic Leap 数据架构修复方案

**日期**: 2026-05-13
**状态**: Ready for Implementation (经 Swarm Review 修订)
**版本**: 1.1

---

## 1. 背景与目标

### 1.1 问题概述

对 Academic Leap 项目进行深度数据架构审查，发现 **11 个 CRITICAL** 和 **21 个 HIGH** 问题，主要分布在：

| 类别 | CRITICAL | HIGH |
|------|----------|------|
| 安全认证 | 3 | 3 |
| 数据完整性 | 4 | 6 |
| 架构/设计 | 0 | 6 |
| API层 | 1 | 4 |
| 性能 | 0 | 3 |
| 未闭环功能 | 3 | 0 |

### 1.2 修复目标

1. **安全**: 修复管理员认证漏洞，防止身份伪造
2. **稳定**: 消除运行时崩溃风险（连接池泄漏、数据损坏）
3. **一致**: 统一 API 响应格式、数据模型
4. **可维护**: 添加基础架构层（Repository骨架、共享错误处理）

### 1.3 不涉及范围

- 完整推荐系统整合（RL ↔ Practice 数据流）
- 事件溯源/CQRS 架构
- Schema 版本控制策略

---

## 2. CRITICAL 问题修复

### 2.1 安全认证 (3个)

#### S1: Admin Token 可伪造

**位置**: `lib/admin-auth.ts:51-53`

**问题**: `btoa(JSON.stringify(payload))` 无签名，攻击者可伪造任意 userId

**修复方案**: 使用 HMAC-SHA256 签名

```typescript
import { createHmac } from 'crypto';

// ⚠️ 修复: 不使用 fallback，生产环境必须配置
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  throw new Error('ADMIN_SECRET environment variable is required');
}

export function createAdminToken(userId: string): string {
  const payload = { userId, createdAt: Date.now() };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHmac('sha256', ADMIN_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export function verifyAdminToken(token: string): { userId: string; createdAt: number } | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    // 验证签名
    const expectedSignature = createHmac('sha256', ADMIN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    // 验证过期 (7天)
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    const age = Date.now() - payload.createdAt;
    if (age > 7 * 24 * 60 * 60 * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}
```

**middleware.ts 更新**: 替换 `JSON.parse(Buffer.from(adminToken.value, 'base64').toString())` 为 `verifyAdminToken()`

---

#### S2: 明文密码比较

**位置**: `app/api/admin/login/route.ts:25`

**问题**: `user.password !== password` 明文比较，数据库若存哈希则永远失败

**修复方案**: 使用 bcrypt.compare

```typescript
import bcrypt from 'bcryptjs';

// 注册时 (已有)
const hashedPassword = await bcrypt.hash(password, 10);

// 登录时 (修复)
if (!user || !(await bcrypt.compare(password, user.password))) {
  return NextResponse.json(
    { success: false, error: '邮箱或密码错误', code: 'INVALID_CREDENTIALS' },
    { status: 401 }
  );
}
```

**注意**: 需要迁移现有明文密码。

⚠️ **注意**: 无法登录用户无法触发迁移，存在登录死锁风险。建议在上线前通过带外脚本预先迁移：
```typescript
// scripts/migrate-admin-passwords.ts
const users = await prisma.adminUser.findMany();
for (const user of users) {
  if (user.password.length < 60) { // 明文密码
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(user.password, 10) }
    });
  }
}
```
仅在上线前执行一次，避免依赖登录触发迁移。

---

#### S3: 默认凭证硬编码

**位置**: `app/console/login/page.tsx:11,154`

**问题**: `admin@example.com / admin123` 暴露在源码

**修复方案**:

```typescript
// 始终留空，默认凭证不应存在于源码
const formData = useState({
  email: '',
  password: '',
});

// 如需默认凭证，使用 .env.local 而非源码传递
// .env.local: ADMIN_EMAIL=admin@test.com, ADMIN_PASSWORD=xxx
```

**验证**: 搜索源码 `admin@example.com` / `admin123` 应无结果。

同时在登录页移除测试凭证展示。

---

### 2.2 数据完整性 (4个)

#### D1: PrismaClient 重复创建

**位置**: `lib/qie/uok.ts:804,844,891`

**问题**: 每次方法调用 `new PrismaClient()` 创建新连接池，finally 中 `$disconnect()` 导致连接泄漏

**修复方案**: 使用项目已有单例

```typescript
// 删除动态 import 和 new PrismaClient()
// 改为:
import { prisma } from '@/lib/prisma';

async saveStudentState(studentId: string): Promise<void> {
  // 直接使用单例，不手动 disconnect
  await prisma.uOKState.upsert({ /* ... */ });
}

// 删除 finally { await prisma.$disconnect(); }
```

**影响的三个方法**:
- `saveStudentState()` (行804)
- `loadStudentState()` (行844)
- `saveQuestionState()` (行891)

---

#### D2: accuracy 字段写入空对象

**位置**: `lib/rl/history/le-history-service.ts:113`

**问题**: `accuracy: {}` 写入 null 值，后续读取计算错误

**修复方案**: 分两阶段更新

```typescript
// 方案A: 移除 accuracy 字段写入，让读取时计算
update: {
  correct: { increment: correct ? 1 : 0 },
  total: { increment: 1 },
  lastUpdatedAt: new Date()
}

// 读取时计算
const state = await prisma.lEKnowledgePointState.findUnique({ where: { id } });
return state.correct / state.total;

// 方案B: 使用 Prisma 原子更新 + RETURNING
await prisma.$executeRaw`
  UPDATE "learning_knowledge_point_state"
  SET correct = correct + ${correct ? 1 : 0},
      total = total + 1,
      accuracy = (correct + ${correct ? 1 : 0})::float / (total + 1),
      last_updated_at = NOW()
  WHERE id = ${state.id}
`;
```

**推荐方案A**，移除冗余字段。

---

#### D3: RLModelVersion 缺少 deployedAt

**位置**: `lib/rl/persistence/model-store.ts:151`

**问题**: 查询 `orderBy: { deployedAt: 'desc' }` 但 schema 无此字段

**修复方案**:

```prisma
model RLModelVersion {
  // ... existing fields
  trainedAt      DateTime @default(now())
  deployedAt    DateTime?  // 添加此字段
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  status        String @default("TRAINING") // TRAINING | READY | DEPLOYED
}
```

**同时修复查询**: 改用 `orderBy: { createdAt: 'desc' }` 或 `deployedAt: 'desc'`

---

#### D4: RLTrainingLog 字段不匹配

⚠️ **已验证为误报** - `postAccuracy` 和 `leDelta` 字段在 `schema.prisma:672-673` 已正确定义，无需修改。

`logTraining()` 调用传入这两个参数是正确的，设计方案中此问题无需修复。

**已移除此修复**。

---

### 2.3 功能未闭环 (3个)

#### F1: AI模板填充未实现

**位置**: `lib/ai/question-generator/template-filler.ts` (已确认存在)

**修复方案**: 标记为实验态或实现占位逻辑

```typescript
async fillTemplateWithAI(
  templateId: string,
  params: Record<string, any>
): Promise<FillResult> {
  // TODO: 实现 AI 填充逻辑
  throw new Error('Template AI fill is not yet implemented. Use manual fill instead.');
}
```

同时在调用处添加 try-catch 和降级逻辑。

---

#### F2: RL重新校准未实现

**位置**: `app/api/rl/recalibrate/route.ts:39-44`

**修复方案**: 实现基本校准逻辑

⚠️ **降级实现说明**: 当前仅重置 `lastSelectedAt`（探索率重置的前置操作），不是真正的 Q-value 校准。

```typescript
export async function POST(req: NextRequest) {
  const { studentId, targetDifficulty } = await req.json();

  // 降级实现: 重置 bandit 探索率
  await prisma.rLBanditArm.updateMany({
    where: { studentId },
    data: { lastSelectedAt: new Date() }
  });

  return NextResponse.json({
    success: true,
    questionsRecalibrated: 0 // 降级: 暂未实现计数，后续补全
  });
}
```

后续需实现真正的校准逻辑：重置 Q-values、epsilon、visit counts。

---

#### F3: 管理员权限检查缺失

**位置**: `app/api/questions/route.ts:49`

**修复方案**: 添加权限检查

```typescript
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  // 添加权限检查
  await requireAdmin('admin'); // 或 'editor'

  // ... 原有逻辑
}
```

---

### 2.4 知识点系统 (1个)

#### K1: knowledgePoints 格式混用

**位置**: `app/api/practice/finish/route.ts:82`

⚠️ **澄清**: 当前 `Question.knowledgePoints` 字段存储的是**名称字符串**（非 ID），如 `["加法交换律", "整数运算"]`。

**修复方案**: 统一解析函数，将 `parseKnowledgePointIds` 改名为 `parseKnowledgePointNames`，并放在共享工具文件 `lib/utils/kp-parse.ts` 中。

```typescript
// lib/utils/kp-parse.ts
export function parseKnowledgePointNames(kp: string | string[] | null): string[] {
  if (!kp) return [];
  if (Array.isArray(kp)) return kp;
  try {
    const parsed = JSON.parse(kp);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
```

**需要修复的文件**:
- `app/api/practice/finish/route.ts`
- `app/api/practice/recommend/route.ts`
- `app/api/analytics/overview/route.ts`

**共享文件**: `lib/utils/kp-parse.ts` (新建)
- `app/api/practice/recommend/route.ts`
- `app/api/analytics/overview/route.ts`

---

## 3. HIGH 问题修复

### 3.1 静默失败处理

统一错误处理模式:

```typescript
// lib/errors.ts
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.error(`[SafeJson] Parse failed: ${json.slice(0, 100)}`, e);
    return fallback;
  }
}

// 应用到所有 JSON.parse 场景
const answers = safeJsonParse(session.answers, []);
```

**需要修复的位置** (优先级):
1. `lib/practice/session-service.ts:199,234`
2. `app/api/analytics/overview/route.ts:93,118`
3. `lib/question-generator.ts:88,142`
4. `lib/redis/index.ts:68`

---

### 3.2 Repository 层骨架

添加基础 Repository 接口和实现:

```typescript
// lib/repositories/base.repository.ts
export interface Repository<T, CreateDto, UpdateDto> {
  findById(id: string): Promise<T | null>;
  findMany(options?: FindOptions): Promise<T[]>;
  create(data: CreateDto): Promise<T>;
  update(id: string, data: UpdateDto): Promise<T>;
  delete(id: string): Promise<void>;
}

// lib/repositories/question.repository.ts
import { prisma } from '@/lib/prisma';

export class QuestionRepository {
  async findById(id: string) {
    return prisma.question.findUnique({
      where: { id },
      include: { steps: true }
    });
  }

  async findWithKnowledgePoints(kpIds: string[], limit = 100) {
    return prisma.question.findMany({
      where: {
        OR: kpIds.map(id => ({
          knowledgePoints: { contains: id }
        }))
      },
      take: limit
    });
  }
}

export const questionRepository = new QuestionRepository();
```

---

### 3.3 API 响应格式统一

```typescript
// lib/api-response.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(
  error: string,
  code?: string,
  status = 500
) {
  return NextResponse.json(
    { success: false, error, errorCode: code },
    { status }
  );
}

// 在所有 API routes 中使用
export async function GET() {
  try {
    const data = await getData();
    return successResponse(data);
  } catch (e) {
    return errorResponse('Failed to fetch data', 'FETCH_ERROR', 500);
  }
}
```

---

### 3.4 FK 索引添加

```prisma
// schema.prisma - 添加索引
model KnowledgePoint {
  id         String @id @default(cuid())
  chapterId  String
  conceptId  String

  @@index([chapterId])
  @@index([conceptId])
}

model Attempt {
  id       String @id @default(cuid())
  userId   String
  // ...

  @@index([userId])
}

model AttemptStep {
  id        String @id @default(cuid())
  attemptId String
  // ...

  @@index([attemptId])
}
```

**需要添加索引的字段** (来自审查报告):
- KnowledgePoint: chapterId, conceptId
- TextbookVersion: subjectId
- QuestionStep: questionId
- Attempt: userId
- AttemptStep: attemptId
- Assessment: userId
- PredictionLog: userId
- Streak: profileId
- Achievement: profileId
- RLTrainingLog: modelId

---

### 3.5 JSON 类型优化

```prisma
// 将 String @default("{}") 改为 Json
model Question {
  complexitySpec Json @default("{}") // 原 String @default("{}")
}

model LearningPath {
  knowledgeData Json @default("[]") // 原 String @default("[]")
}

// 应用层无需修改，Prisma 自动处理序列化
```

**注意**: 这是 schema 变更，需要:
1. `npx prisma db push` 或 migration
2. 验证数据迁移正确性

---

## 4. 架构改进

### 4.1 项目结构

```
lib/
├── repositories/           # 新增: Repository 层
│   ├── base.repository.ts
│   ├── question.repository.ts
│   ├── user.repository.ts
│   └── index.ts
├── api/                    # 新增: 共享 API 工具
│   ├── response.ts
│   └── errors.ts
├── security/              # 新增: 安全相关
│   └── token.ts           # HMAC token 验证
└── ...
```

### 4.2 迁移步骤

1. **Phase 1**: 安全认证修复 (独立，不影响业务)
2. **Phase 2**: 数据完整性修复 (独立)
3. **Phase 3**: 架构层添加 (渐进式)
4. **Phase 4**: 索引和类型优化 (需要迁移)

---

## 5. 验证计划

### 5.1 单元测试

```typescript
describe('AdminToken', () => {
  it('should create and verify token', () => {
    const token = createAdminToken('user123');
    const payload = verifyAdminToken(token);
    expect(payload?.userId).toBe('user123');
  });

  it('should reject tampered token', () => {
    const token = createAdminToken('user123');
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(verifyAdminToken(tampered)).toBeNull();
  });
});
```

### 5.2 集成测试

```bash
# 管理员登录
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"correct"}' \
  | jq '.success'

# 预期: true
```

### 5.3 回归测试

- [ ] 现有 E2E 测试全部通过
- [ ] 手动验证: 管理员登录 → 创建题目 → 练习流程
- [ ] 数据库查询性能验证 (EXPLAIN ANALYZE)

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 密码迁移 | 现有管理员无法登录 | 提供密码重置脚本 |
| PrismaClient 移除 disconnect | 连接管理变化 | 测试高并发场景 |
| JSON → Json 类型迁移 | 数据格式变更 | 先备份，测试环境验证 |
| Admin Token 格式变更 | 现有登录会话失效 | 渐进式迁移，兼容旧格式 |

---

## 7. 实施顺序

```
P0 (立即):
├─ S1: Admin Token HMAC 签名
├─ S2: bcrypt.compare 替换
├─ D1: PrismaClient 单例
├─ D2: accuracy 空对象修复
├─ F3: 管理员权限检查
└─ K1: 知识点 ID/名称统一

P1 (本周):
├─ S3: 默认凭证移除
├─ D3: RLModelVersion.deployedAt
├─ D4: RLTrainingLog 字段修复
├─ F1: AI模板填充标记
├─ F2: RL校准基本实现
└─ 静默catch统一处理

P2 (本月):
├─ Repository 层骨架
├─ API 响应格式统一
├─ FK 索引添加
└─ JSON → Json 类型优化

P3 (后续):
└─ 完整推荐系统整合
```

---

## 8. 变更文件清单

| 文件 | 变更类型 | CRITICAL |
|------|----------|----------|
| `lib/admin-auth.ts` | 重写 | S1 |
| `middleware.ts` | 修改 token 验证 | S1 |
| `app/api/admin/login/route.ts` | bcrypt.compare | S2 |
| `app/console/login/page.tsx` | 移除默认凭证 | S3 |
| `lib/qie/uok.ts` | PrismaClient 单例 | D1 |
| `lib/rl/history/le-history-service.ts` | accuracy 修复 | D2 |
| `lib/rl/persistence/model-store.ts` | deployedAt + 字段 | D3, D4 |
| `app/api/questions/route.ts` | 权限检查 | F3 |
| `lib/ai/question-generator/template-filler.ts` | 标记/实现 | F1 |
| `app/api/rl/recalibrate/route.ts` | 基本实现 | F2 |
| `app/api/practice/finish/route.ts` | ID统一 | K1 |
| `prisma/schema.prisma` | deployedAt + 索引 | D3, 索引 |
| `lib/api/response.ts` | 新增 | 统一 |
| `lib/errors.ts` | 新增 | 统一 |
| `lib/repositories/*.ts` | 新增 | 架构 |

---

**设计完成，请审阅。**