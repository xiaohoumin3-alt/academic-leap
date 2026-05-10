# academic-leap Agent-Native 演进设计文档

**日期:** 2026-05-06
**版本:** 1.3 (第三轮 Swarm Review 修正版)
**状态:** 第三轮修正完成 - 待用户批准后进入实施计划

---

## 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-05-06 | 初始设计 |
| 1.1 | 2026-05-06 | 第一轮 Swarm Review 修正：增量迁移策略、简化抽象层、修正数据模型 |
| 1.2 | 2026-05-06 | 第二轮 Swarm Review 修正：Phase 0 明确化、API 迁移策略、ContextCache 实现、时间线拆分 |
| 1.3 | 2026-05-06 | 第三轮 Swarm Review 修正：时间线数字修正、验收标准实现代码、benchmark/verify-dual-write 脚本 |

---

## 1. 概述

### 1.1 目标

将 academic-leap 从当前的功能孤岛架构演进到 Agent-Native 模式，采用**增量迁移 + 自动化验收**策略。

### 1.2 范围

- **实施范围:** 6 阶段（12 周：Phase 0 验证 + Phase 1A + Phase 1B + Phase 2 + Phase 3 + Phase 4）
- **风险偏好:** 增量迁移（先新功能验证，再存量迁移；双写策略）
- **验收标准:** A+B+C+D（功能完整性 + 架构清晰性 + 性能指标 + 测试覆盖）
- **数据迁移:** 增量双写（新旧并存，逐步切换）

### 1.3 方案选择

**方案 B-修正: 分阶段增量迁移**

```
Phase 0 (1周):  架构验证 → 验收
Phase 1 (3周): 上下文层 → 验收
Phase 2 (3周): 插件层 → 验收
Phase 3 (2周): 编排层 → 验收
Phase 4 (2周): RAG层 → 验收
```

### 1.4 Swarm Review 关键发现

**实际复杂度:** 55 个 Prisma models + 115 个 API 路由 + 大量业务逻辑

**关键修正:**
1. 从"全链激进替换"改为"增量迁移 + 双写"
2. 添加 Phase 0 架构验证阶段
3. 简化抽象层（去掉 StreamBus、简化 MemoryForest、静态注册）
4. 修正数据模型（Ability 结构一致性、拆分 Repository）

---

## 2. 整体架构

### 2.1 目标架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                       │
│  Components + Zustand (统一状态管理)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓ API (REST)
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (New)                         │
│  /api/learning/* (统一入口)                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Orchestrator Layer (New)                  │
│  PracticeOrchestrator | DiagnosticOrchestrator | Review     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Plugin Layer (New)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   Tools     │  │Capabilities │  │   Registry       │    │
│  │ (IRT/UOK/   │  │ (Practice/  │  │ (静态注册)        │    │
│  │  Recommend) │  │ Diagnostic) │  │                  │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  UserContext Layer (New)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │UserProfile  │  │   Memory    │  │ KnowledgeGraph   │    │
│  │(统一画像)   │  │ (两层记忆)  │  │  (知识图谱)       │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer (New)                   │
│  Repositories | Prisma | Base64 Embeddings | Services      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

1. **增量迁移** - 新功能用新架构，存量逐步迁移，双写保证数据安全
2. **统一上下文** - `UnifiedContext` 是所有模块的唯一数据来源
3. **简化抽象** - REST API 优先，WebSocket 延后；静态注册优先，动态加载延后
4. **插件化** - `Tools` + `Capabilities` 通过 `Registry` 静态注册

### 2.3 5 阶段演进计划（修正版）

| 阶段 | 周期 | 新增层 | 策略 | 验收标准 |
|------|------|--------|------|----------|
| **Phase 0** | 1周 | 验证原型 | Repository 原型 + 继承现有 E2E | 3 个验证标准全部通过 |
| **Phase 1A** | 1.5周 | UserContext | Repository 抽象（无双写） | ProfileRepository 可用 |
| **Phase 1B** | 1.5周 | UserContext | 双写策略验证 | E2E + 性能 + 覆盖率 |
| **Phase 2** | 3周 | Plugin | 现有模块插件化 | 插件测试 + 集成测试 |
| **Phase 3** | 2周 | Orchestrator | 流程逻辑编排 | 流程测试 |
| **Phase 4** | 2周 | RAG | Base64 向量 + 语义检索 | 检索准确率 > 85% |

**时间线:** 12 周（Phase 0 + Phase 1A + Phase 1B + Phase 2 + Phase 3 + Phase 4）

---

## 3. 数据模型设计

### 3.1 当前状态 → 目标状态

```typescript
// ========== 当前分散状态 ==========
User                    // 用户基础信息
PlayerProfile           // 游戏化画像
StudentAbility          // IRT 能力估计
UOKState                // UOK 知识状态
UserKnowledge           // 知识点掌握
Attempt                 // 答题记录
... 55 个 models

// ========== 目标统一状态（通过 Repository 聚合）==========
interface UnifiedContext {
  userId: string;
  sessionId: string;
  profile: UserProfile;      // 统一画像（聚合多个数据源）
  memory: Memory;            // 两层记忆
  knowledge: KnowledgeGraph; // 知识图谱（全局结构 + 用户掌握度）
}
```

### 3.2 UserProfile（统一画像）

```typescript
// ========== 补充定义 ==========
interface UserPreferences {
  language: 'zh' | 'en';
  difficultyPreference: 'easy' | 'medium' | 'hard';
  dailyGoalMinutes: number;
  notificationEnabled: boolean;
}

interface LearningGoal {
  id: string;
  description: string;
  targetDate: Date;
  progress: number;  // 0-1
}

// ========== UserProfile ==========
interface UserProfile {
  // 基础信息
  id: string;
  email: string;
  preferences: UserPreferences;

  // 统一能力估计（合并 StudentAbility + UOKState + UserKnowledge）
  // 格式: Map<knowledgePointId, Ability>
  abilities: Map<string, Ability>;

  // 游戏化（延后到 Phase 2+）
  gaming?: {
    level: number;
    xp: number;
    achievements: string[];
    streak: number;
  };

  // 学习目标
  goals: LearningGoal[];

  // 元数据
  version: number;
  updatedAt: Date;
}

interface Ability {
  mastery: number;        // 0-1 统一掌握度
  confidence: number;     // 0-1 置信度
  source: 'irt' | 'uok' | 'rl';
  lastUpdated: Date;
}
```

### 3.3 Memory（两层记忆，简化版）

```typescript
// ========== 补充定义 ==========
interface LearningEvent {
  id: string;
  type: 'attempt' | 'feedback' | 'question' | 'hint' | 'navigation';
  timestamp: Date;
  data: unknown;
}

// ========== Memory（简化版）==========
interface Memory {
  userId: string;

  // 即时记忆（当前会话）
  session: {
    id: string;          // 与 UnifiedContext.sessionId 一致
    startTime: Date;
    events: LearningEvent[];
  };

  // 长期记忆（历史聚合）
  longTerm: {
    totalAttempts: number;
    masteryTrend: number[];  // 最近 N 次答题的掌握度趋势
    weakPoints: string[];    // 薄弱知识点 ID
    lastUpdated: Date;
  };
}

// 注：semantic 记忆延后到 Phase 4 RAG 层实现
```

### 3.4 KnowledgeGraph（知识图谱）

```typescript
interface KnowledgeGraph {
  // 全局图结构（不包含用户数据）
  structure: {
    nodes: Map<string, KnowledgeNode>;
    edges: Map<string, string[]>;  // id -> prerequisiteIds
  };

  // 用户掌握度（与 Ability 结构一致）
  userMastery: Map<string, Ability>;  // nodeId -> Ability
}

interface KnowledgeNode {
  id: string;
  name: string;
  description: string;
  level: number;        // 层级深度
  parentIds: string[];
  childIds: string[];
}
```

### 3.5 数据迁移策略（增量双写）

**策略:** 新旧并存，逐步切换，最后清理

```typescript
// Phase 1: Repository 抽象层（双写）
class ProfileRepository implements IProfileRepository {
  async find(userId: string): Promise<UserProfile> {
    // 1. 先读新表
    const newProfile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (newProfile) return this.mapToProfile(newProfile);

    // 2. 回退到旧表（聚合）
    const [user, playerProfile, studentAbilities] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.playerProfile.findUnique({ where: { userId } }),
      this.prisma.studentAbility.findMany({ where: { userId } })
    ]);
    return this.aggregateFromLegacy(user, playerProfile, studentAbilities);
  }

  async save(profile: UserProfile): Promise<void> {
    // Phase 1B: 双写（新旧并存）
    await Promise.all([
      this.prisma.userProfile.upsert({ /* 新表 */ }),
      this.prisma.user.update({ /* 旧表 */ }),
    ]);
  }
}

// Phase 3+: 停止双写，只写新表
// Phase 4: 清理旧表（标记为 deprecated）
```

### 3.6 ContextCache 实现方案

**策略:** Phase 0 用内存缓存，Phase 2+ 评估 Redis 必要性

```typescript
// lib/infrastructure/context-cache.ts

interface ContextCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  invalidate(key: string): Promise<void>;
}

// Phase 0 实现：内存 LRU 缓存
export class InMemoryContextCache implements ContextCache {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private maxSize = 1000;
  private ttl = 300000; // 5 分钟

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      // LRU: 删除最早的条目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (options?.ttl ?? this.ttl)
    });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }
}
```

### 3.7 API 统一入口迁移策略

**策略:** 增量切换，从 Profile 入口开始

```typescript
// Phase 1A: 新增统一入口（不影响现有路由）
// app/api/learning/profile/route.ts
// - GET /api/learning/profile → 获取用户画像
// - PATCH /api/learning/profile → 更新用户画像

// Phase 1B: 其他路由逐步切换到新入口
// app/api/practice/next-question/route.ts
// - 原：直接调用 prisma.userKnowledge.findMany()
// - 新：通过 ProfileRepository 获取 abilities

// Phase 2: 切换存量路由
// app/api/analytics/learning-path/route.ts
// - 使用 KnowledgeGraph 替代分散的知识点查询

// Phase 3+: 清理旧路由
// - 删除不再使用的 prisma 直接调用
// - 旧表标记为 deprecated
```

**迁移优先级:**
1. `/api/learning/profile` - Phase 1A 新增
2. `/api/practice/*` - Phase 1B 切换
3. `/api/analytics/*` - Phase 2 切换
4. `/api/learning-path/*` - Phase 3 切换

---

## 4. 核心接口设计

### 4.1 UnifiedContext

```typescript
interface UnifiedContext {
  // 会话标识
  userId: string;
  sessionId: string;

  // 三大核心模型
  profile: UserProfile;
  memory: Memory;
  knowledge: KnowledgeGraph;

  // 配置
  enabledTools: string[];
  activeCapability: string;
  language: 'zh' | 'en';
}
```

### 4.2 UserContextManager

```typescript
class UserContextManager {
  constructor(
    private profileRepo: ProfileRepository,
    private memoryRepo: MemoryRepository,
    private knowledgeRepo: KnowledgeRepository,
    private cache: ContextCache
  ) {}

  // 加载完整上下文
  async load(userId: string): Promise<UnifiedContext>;

  // 保存变更（自动合并）
  async save(context: UnifiedContext): Promise<void>;

  // 增量更新能力（乐观锁）
  async updateAbility(
    userId: string,
    nodeId: string,
    delta: {
      mastery?: number;
      confidence?: number;
      source?: Ability['source'];
    }
  ): Promise<void>;
}
```

### 4.3 Repository 接口（修正版）

```typescript
// ========== 补充定义 ==========
interface ContextCache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>;
  invalidate(key: string): Promise<void>;
}

// ========== Profile Repository ==========
interface ProfileRepository {
  find(userId: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}

// ========== Memory Repository ==========
interface MemoryRepository {
  find(userId: string): Promise<Memory | null>;
  save(memory: Memory): Promise<void>;
  appendEvent(userId: string, event: LearningEvent): Promise<void>;
  getSession(userId: string, sessionId: string): Promise<MemorySession | null>;
}

// ========== Knowledge Repository（拆分）==========
interface KnowledgeRepository {
  // 全局图结构（缓存）
  getStructure(): Promise<KnowledgeGraphStructure>;
  getNode(id: string): Promise<KnowledgeNode | null>;

  // 用户掌握度（用户特定）
  getUserMastery(userId: string): Promise<Map<string, Ability>>;
  updateMastery(userId: string, nodeId: string, ability: Ability): Promise<void>;
}
```

---

## 5. 插件层设计

### 5.1 Tool（工具层）

```typescript
// ========== 补充定义 ==========
interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description?: string;
  default?: unknown;
}

interface ToolResult<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ========== Base Tool ==========
abstract class BaseTool {
  abstract readonly definition: ToolDefinition;

  // 执行工具
  abstract execute(context: UnifiedContext, params: unknown): Promise<ToolResult>;

  // 验证参数
  protected validate<T>(schema: z.Schema<T>, data: unknown): T {
    return schema.parse(data);
  }
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}
```

### 5.2 Capability（能力层）

```typescript
// ========== 补充定义 ==========
interface CapabilityResult {
  success: boolean;
  data?: unknown;
  error?: string;
  contextUpdates?: Partial<UnifiedContext>;
}

// ========== Base Capability ==========
abstract class BaseCapability {
  abstract readonly manifest: CapabilityManifest;

  // 执行多阶段流程
  abstract execute(
    context: UnifiedContext,
    input: unknown
  ): Promise<CapabilityResult>;

  // 阶段钩子
  protected async runStage<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // 简化版：去掉 stream 参数，Phase 3 再扩展
    return await fn();
  }
}

interface CapabilityManifest {
  name: string;
  description: string;
  stages: string[];
  requiredTools: string[];
}
```

### 5.3 Registry（插件注册，简化版）

```typescript
class PluginRegistry {
  private tools = new Map<string, BaseTool>();
  private capabilities = new Map<string, BaseCapability>();

  // 注册工具
  registerTool(tool: BaseTool): void {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`Tool ${tool.definition.name} already registered`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  // 注册能力
  registerCapability(capability: BaseCapability): void {
    if (this.capabilities.has(capability.manifest.name)) {
      throw new Error(`Capability ${capability.manifest.name} already registered`);
    }
    // 验证依赖工具
    for (const toolName of capability.manifest.requiredTools) {
      if (!this.tools.has(toolName)) {
        throw new Error(`Required tool ${toolName} not found`);
      }
    }
    this.capabilities.set(capability.manifest.name, capability);
  }

  // 获取
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getCapability(name: string): BaseCapability | undefined {
    return this.capabilities.get(name);
  }

  // 注：autoRegister 延后到 Phase 2+
}
```

---

## 6. 验收标准设计

### 6.1 自动化验收框架（简化版）

```typescript
interface VerificationStandard {
  name: string;
  description: string;
  verify(): Promise<VerificationResult>;
}

interface VerificationResult {
  passed: boolean;
  score?: number;  // 0-100
  details: Array<{
    level: 'error' | 'warning' | 'info';
    message: string;
  }>;
}

class VerificationRunner {
  constructor(private standards: VerificationStandard[]) {}

  async runAll(): Promise<VerificationReport> {
    const results = await Promise.all(
      this.standards.map(async (standard) => ({
        name: standard.name,
        ...(await standard.verify())
      }))
    );

    const passed = results.every(r => r.passed);
    const avgScore = results.reduce((sum, r) => sum + (r.score ?? 0), 0) / results.length;

    return {
      passed,
      score: avgScore,
      results
    };
  }
}
```

### 6.2 Phase 0 验收标准（架构验证，修正版）

**Phase 0 目标:** 验证 Repository 抽象架构可行性 + 不退化现有功能

| 标准 | 类型 | 验证方法 | 阈值 |
|------|------|----------|------|
| **E2E-无退化** | 功能 | 继承现有 `tests/grade8-math-e2e.test.ts` | 全部通过 |
| **Repo-接口定义** | 架构 | 检查 `lib/repositories/` 目录存在 + IProfileRepository 接口定义 | 存在 |
| **Proto-Repository** | 架构 | ProfileRepository 基础实现（find/save） | 可实例化 |

**Phase 0 具体输出物:**
1. `lib/repositories/interfaces/IProfileRepository.ts` - 接口定义
2. `lib/repositories/ProfileRepository.ts` - 基础实现（聚合 User + PlayerProfile + StudentAbility）
3. `tests/validation/phase0-repo-standards.ts` - 验收标准实现
4. `pnpm test:smoke` 通过（Playwright smoke 测试）

**Phase 0 验收标准实现:**

```typescript
// tests/validation/phase0-repo-standards.ts
import { describe, it, expect } from 'vitest';
import { ProfileRepository } from '@/lib/repositories/ProfileRepository';

describe('Phase 0: Repository 架构验证', () => {
  it('IProfileRepository 接口应导出到 lib/repositories/index.ts', async () => {
    const module = await import('@/lib/repositories');
    expect(module.IProfileRepository).toBeDefined();
  });

  it('ProfileRepository 应可实例化', () => {
    const repo = new ProfileRepository(mockPrisma);
    expect(repo).toBeDefined();
  });

  it('ProfileRepository.find 应返回 UserProfile | null', async () => {
    const repo = new ProfileRepository(mockPrisma);
    const result = await repo.find('test-user-id');
    // 不要求有数据，但接口应正确
    expect(result === null || typeof result === 'object').toBe(true);
  });
});
```

**Phase 0 不做:**
- 双写策略（延后到 Phase 1B）
- Memory/MemoryRepository 实现（延后到 Phase 1A）
- KnowledgeGraph 实现（延后到 Phase 1B）
- `tests/acceptance/` 目录（项目使用 `tests/validation/`）

### 6.3 Phase 1A/1B 验收标准

**Phase 1A: Repository 抽象（1.5 周）**

| 标准 | 类型 | 验证方法 | 阈值 |
|------|------|----------|------|
| ProfileRepository 可用 | 功能 | 实例化 + find/save 基本操作 | 成功 |
| MemoryRepository 可用 | 功能 | 实例化 + find/save 基本操作 | 成功 |
| KnowledgeRepository 可用 | 功能 | 实例化 + getStructure 基本操作 | 成功 |
| E2E 无退化 | 功能 | `pnpm test:smoke` 通过 | 全部通过 |
| **Performance 基准** | 性能 | `scripts/benchmark-repository.ts` | 建立 p95 基准 |

**性能基准脚本:**

```typescript
// scripts/benchmark-repository.ts
/**
 * 性能基准测试脚本
 * 建立 Repository 操作的 p95 响应时间基准
 */

// 执行方式:
// npx ts-node scripts/benchmark-repository.ts --runs=1000

interface BenchmarkReport {
  operation: string;    // 'find' | 'save'
  p50: number;        // ms
  p95: number;        // ms (Phase 1B 基准)
  p99: number;        // ms
}
```

**Phase 1B: 双写验证（1.5 周）**

| 标准 | 类型 | 验证方法 | 阈值 |
|------|------|----------|------|
| 双写数据一致性 | 功能 | `scripts/verify-dual-write.ts` 对比新旧表 | 差异率 < 1% |
| Performance: p95 | 性能 | Phase 1A 基准 + 负载测试 | p95 退化 < 100ms |
| Coverage: Unit + Integration | 测试 | 覆盖率报告 | > 80% |
| Architecture: Repository Only | 架构 | 代码扫描 | 0 违规 |

**双写验证脚本:**

```typescript
// scripts/verify-dual-write.ts
/**
 * 双写一致性验证脚本
 * 对比新旧表数据，输出差异率报告
 */

// 对比字段：abilities.mastery, abilities.confidence
// 差异率 = 差异记录数 / 总记录数 * 100

interface DualWriteReport {
  totalRecords: number;
  diffRecords: number;
  diffRate: number;  // < 1% 通过
  diffDetails: Array<{ userId: string; field: string; old: unknown; new: unknown }>;
}

// 执行方式:
// npx ts-node scripts/verify-dual-write.ts --sample=1000
```

### 6.4 CI/CD 集成

每个 Phase 必须通过 CI 验收关卡才能合并：

```yaml
# 验收通过条件
- 所有 VerificationStandard.passed = true
- 平均分数 >= 80
- 无 error 级别问题
```

---

## 7. 风险与缓解（更新版）

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 数据迁移失败 | 高 | 低 | 双写策略 + 旧表保留 + 回滚预案 |
| 性能退化 | 中 | 低 | 基准测试 + 性能监控 + 双写性能优化 |
| 功能回归 | 高 | 中 | E2E 测试 + Phase 0 架构验证 |
| 开发延期 | 中 | 中 | 每周验收关卡，及时调整 |
| 抽象层过度复杂 | 中 | 低 | 简化策略：REST 优先、静态注册、两层记忆 |

---

## 8. Swarm Review 修正总结

### 8.1 第一轮修正（v1.0 → v1.1）

| 方面 | 修正前 | 修正后 |
|------|--------|--------|
| 演进策略 | 全链激进替换 | 增量迁移 + 双写 |
| 阶段 | 4 阶段 | 5 阶段（含 Phase 0） |
| 抽象层 | StreamBus + 动态注册 | REST + 静态注册 |
| 记忆模型 | 4 层 MemoryForest | 2 层 Memory |
| 数据模型 | mastery 类型不一致 | 统一 Ability 结构 |
| Repository | 混合全局/用户 | 拆分为 getStructure/getUserMastery |

### 8.2 第二轮修正（v1.1 → v1.2）

| 方面 | 修正前 | 修正后 |
|------|--------|--------|
| Phase 0 范围 | 模糊（"学习路径推荐 E2E"） | 明确：继承现有 E2E + Repository 原型 |
| API 迁移策略 | 缺失 | 补充：增量切换优先级 |
| ContextCache | 缺失实现方案 | 补充：内存 LRU 缓存 |
| 时间线 | Phase 1 (3周) | Phase 1A (1.5周) + Phase 1B (1.5周) |

### 8.3 第三轮修正（v1.2 → v1.3）

| 方面 | 修正前 | 修正后 |
|------|--------|--------|
| 时间线描述 | "11 周" | "12 周" |
| Phase 0 输出物路径 | `tests/acceptance/` | `tests/validation/`（符合项目实际） |
| 验收标准实现 | 缺具体代码 | 补充 `phase0-repo-standards.ts` 实现 |
| Phase 1A 性能基准 | 缺失 | 补充 `scripts/benchmark-repository.ts` |
| Phase 1B 双写验证 | "差异率 < 1%" | 补充 `scripts/verify-dual-write.ts` 实现 |

### 8.4 时间线最终调整

```
v1.0: 10 周（4 阶段）
v1.1: 11 周（5 阶段）
v1.2: 12 周（6 阶段）
v1.3: 12 周（6 阶段，含具体验收实现代码）
```

---

## 9. 下一步

1. **用户批准修正版设计** - 确认修正方向正确
2. **创建实施计划** - 使用 writing-plans 技能
3. **启动 Phase 0** - 架构验证（1 周）
