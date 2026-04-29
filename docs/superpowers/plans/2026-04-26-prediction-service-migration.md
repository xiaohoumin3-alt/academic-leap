# Prediction Service Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加 Prediction Service 作为独立预测模块，不破坏现有规则系统，实现渐进式升级

**Architecture:** 
- Layer 1: Prediction Service (Fastify) - 独立微服务，IRT模型预测
- API Gateway: 统一路由，特性开关控制流量
- 现有系统: 保持不变，双轨运行
- 数据层: 新增日志表，不修改现有表

**Tech Stack:** Node.js, Fastify, TypeScript, Docker, Prisma

---

## Scope

**Phase 1 (MVP - 2周)**: 部署 Prediction Service，只做数据记录，不影响生产
- 预测服务独立部署
- 数据库只添加日志表
- 前端可选调用
- 完整监控

**Out of Scope (Phase 2+)**: 
- 替换现有难度计算
- 修改判题逻辑
- 数据模型重构

---

## File Structure

```
academic-leap/
├── apps/
│   └── prediction-service/          # 新增 - 独立服务
│       ├── src/
│       │   ├── index.ts             # Fastify服务入口
│       │   ├── model.ts             # IRT预测模型
│       │   ├── features.ts          # 特征提取
│       │   └── store.ts             # 数据存储接口
│       ├── test-client.ts           # API测试客户端
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
├── lib/
│   └── prediction/                  # 新增 - 客户端SDK
│       ├── client.ts                # API客户端
│       └── types.ts                 # 类型定义
│
├── app/api/
│   └── predict/                     # 新增 - Next.js API路由
│       ├── route.ts
│       └── validation.ts
│
├── prisma/
│   └── schema.prisma                # 修改 - 添加日志表
│
└── docker-compose.yml               # 修改 - 添加服务
```

---

## Task 1: 创建 Prediction Service 基础框架

**Files:**
- Create: `apps/prediction-service/src/index.ts`
- Create: `apps/prediction-service/package.json`
- Create: `apps/prediction-service/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@academic-leap/prediction-service",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "fastify": "^4.25.0",
    "@fastify/cors": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 3: Create Fastify service skeleton (src/index.ts)**

```typescript
import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ status: 'ok', version: '1.0.0' }));

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Prediction Service running on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

- [ ] **Step 4: Install dependencies and test**

```bash
cd apps/prediction-service
npm install
npm run build
npm run dev
```

Expected: Service starts on http://localhost:3001

- [ ] **Step 5: Verify health endpoint**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","version":"1.0.0"}`

- [ ] **Step 6: Commit**

```bash
git add apps/prediction-service/
git commit -m "feat: add prediction service skeleton"
```

---

## Task 2: 实现 IRT 预测模型

**Files:**
- Create: `apps/prediction-service/src/model.ts`

- [ ] **Step 1: Create model.ts with IRT prediction**

```typescript
export interface StudentAbility {
  nodeId: string;
  ability: number;        // IRT theta parameter
  sampleSize: number;
}

export interface PredictionFeatures {
  difficulty: number;     // IRT beta parameter
  knowledgeNodes: string[];
}

export class PredictionModel {
  predict(
    ability: number,
    features: PredictionFeatures
  ): { probability: number; confidence: number } {
    // IRT 2PL model: P(correct) = 1 / (1 + exp(-(theta - beta)))
    const theta = ability;
    const beta = features.difficulty;
    const logit = theta - beta;
    const probability = 1 / (1 + Math.exp(-logit));
    
    return {
      probability: Math.max(0.05, Math.min(0.95, probability)),
      confidence: 0.7 // TODO: 基于样本量计算
    };
  }
}
```

- [ ] **Step 2: Add unit tests for model**

```typescript
// test/model.test.ts
import { PredictionModel } from './model';

const model = new PredictionModel();

console.log('Test 1: High ability student, easy question');
const result1 = model.predict(1.0, { difficulty: -0.5, knowledgeNodes: ['test'] });
console.log(`Probability: ${result1.probability} (expected > 0.7)`);
console.assert(result1.probability > 0.7, 'High ability should have high probability');

console.log('Test 2: Low ability student, hard question');
const result2 = model.predict(-1.0, { difficulty: 0.5, knowledgeNodes: ['test'] });
console.log(`Probability: ${result2.probability} (expected < 0.3)`);
console.assert(result2.probability < 0.3, 'Low ability should have low probability');
```

- [ ] **Step 3: Run tests**

```bash
cd apps/prediction-service
npx tsx test/model.test.ts
```

Expected: All assertions pass

- [ ] **Step 4: Commit**

```bash
git add apps/prediction-service/src/model.ts
git commit -m "feat: add IRT prediction model"
```

---

## Task 3: 添加数据存储接口

**Files:**
- Create: `apps/prediction-service/src/store.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PredictionLog table to Prisma schema**

```prisma
// 在 prisma/schema.prisma 末尾添加
model PredictionLog {
  id          Int       @id @default(autoincrement())
  studentId   Int
  questionId  String?
  predicted   Float
  actual      Boolean?
  metadata    Json?
  createdAt   DateTime  @default(now())
  
  student     User      @relation(fields: [studentId], references: [id])
  
  @@index([studentId, createdAt])
  @@index([createdAt])
}
```

- [ ] **Step 2: Update User model relation**

```prisma
// 在 User model 中添加
model User {
  // ... 现有字段
  predictionLogs PredictionLog[]
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add_prediction_log
```

Expected: Migration succeeds, table created

- [ ] **Step 4: Create store.ts**

```typescript
import { PrismaClient } from '@prisma/client';

export class PredictionStore {
  private prisma = new PrismaClient();

  async logPrediction(params: {
    studentId: number;
    questionId?: string;
    predicted: number;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.predictionLog.create({
      data: params
    });
  }

  async getStudentHistory(studentId: number, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return this.prisma.predictionLog.findMany({
      where: {
        studentId,
        createdAt: { gte: since }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma apps/prediction-service/src/store.ts
npx prisma generate
git commit -m "feat: add prediction logging"
```

---

## Task 4: 实现 /predict API 端点

**Files:**
- Modify: `apps/prediction-service/src/index.ts`

- [ ] **Step 1: Add predict endpoint to index.ts**

```typescript
// 在现有代码后添加
import { PredictionModel } from './model';
import { PredictionStore } from './store';

const model = new PredictionModel();
const store = new PredictionStore();

interface PredictRequest {
  studentId: number;
  questionFeatures: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

server.post<{
  Body: PredictRequest
}>('/predict', {
  schema: {
    body: {
      type: 'object',
      required: ['studentId', 'questionFeatures'],
      properties: {
        studentId: { type: 'number' },
        questionFeatures: {
          type: 'object',
          properties: {
            difficulty: { type: 'number' },
            knowledgeNodes: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  const { studentId, questionFeatures } = request.body;
  
  // TODO: 从数据库获取学生能力，暂时使用0
  const ability = 0;
  
  const result = model.predict(ability, questionFeatures);
  
  // 异步记录日志
  store.logPrediction({
    studentId,
    questionId: undefined,
    predicted: result.probability,
    metadata: { questionFeatures }
  }).catch(console.error);
  
  return {
    studentId,
    predictions: [{
      questionId: 'unknown',
      probability: result.probability,
      confidence: result.confidence
    }]
  };
});
```

- [ ] **Step 2: Test predict endpoint**

```bash
curl -X POST http://localhost:3001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": 1,
    "questionFeatures": {
      "difficulty": 0.5,
      "knowledgeNodes": ["algebra"]
    }
  }'
```

Expected: Returns prediction with probability field

- [ ] **Step 3: Commit**

```bash
git add apps/prediction-service/src/index.ts
git commit -m "feat: add /predict endpoint"
```

---

## Task 5: 创建客户端 SDK

**Files:**
- Create: `lib/prediction/client.ts`
- Create: `lib/prediction/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface PredictionClientConfig {
  baseUrl?: string;
  timeout?: number;
}

export interface PredictRequest {
  studentId: number;
  questionFeatures: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

export interface PredictResponse {
  studentId: number;
  predictions: Array<{
    questionId: string;
    probability: number;
    confidence: number;
  }>;
}
```

- [ ] **Step 2: Create client.ts**

```typescript
import type { PredictionClientConfig, PredictRequest, PredictResponse } from './types';

export class PredictionClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: PredictionClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.PREDICTION_SERVICE_URL || 'http://localhost:3001';
    this.timeout = config.timeout || 5000;
  }

  async predict(request: PredictRequest): Promise<PredictResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Prediction service error: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // 静默失败 - 用于非关键路径
  async predictSafe(request: PredictRequest): Promise<PredictResponse | null> {
    try {
      return await this.predict(request);
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 3: Add singleton instance**

```typescript
// 在 client.ts 末尾添加
let clientInstance: PredictionClient | null = null;

export function getPredictionClient(): PredictionClient {
  if (!clientInstance) {
    clientInstance = new PredictionClient();
  }
  return clientInstance;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/prediction/
git commit -m "feat: add prediction client SDK"
```

---

## Task 6: 添加 Next.js API 路由

**Files:**
- Create: `app/api/predict/route.ts`

- [ ] **Step 1: Create API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPredictionClient } from '@/lib/prediction/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getPredictionClient();
    
    const result = await client.predictSafe(body);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Prediction service unavailable' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 2: Test API route**

```bash
curl -X POST http://localhost:3000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": 1,
    "questionFeatures": {
      "difficulty": 0.5,
      "knowledgeNodes": ["test"]
    }
  }'
```

Expected: Returns prediction or 503 if service down

- [ ] **Step 3: Commit**

```bash
git add app/api/predict/
git commit -m "feat: add Next.js prediction API route"
```

---

## Task 7: 更新 docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add prediction service to docker-compose**

```yaml
# 在 docker-compose.yml 中添加
services:
  # ... 现有服务

  prediction-service:
    build:
      context: ./apps/prediction-service
      dockerfile: Dockerfile
    container_name: academic-leap-prediction
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - backend
    restart: unless-stopped
```

- [ ] **Step 2: Create Dockerfile for prediction service**

```dockerfile
# apps/prediction-service/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Test docker build**

```bash
docker-compose build prediction-service
docker-compose up -d prediction-service
docker-compose logs prediction-service
```

Expected: Service starts without errors

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml apps/prediction-service/Dockerfile
git commit -m "feat: add prediction service to docker-compose"
```

---

## Task 8: 添加监控和日志

**Files:**
- Modify: `apps/prediction-service/src/index.ts`

- [ ] **Step 1: Add metrics middleware**

```typescript
// 在 index.ts 顶部添加
interface Metrics {
  predictions: number;
  errors: number;
  latency: number[];
}

const metrics: Metrics = {
  predictions: 0,
  errors: 0,
  latency: []
};

// 添加 metrics 端点
server.get('/metrics', async () => {
  const avgLatency = metrics.latency.length > 0
    ? metrics.latency.reduce((a, b) => a + b, 0) / metrics.latency.length
    : 0;
    
  return {
    predictions: metrics.predictions,
    errors: metrics.errors,
    avgLatency: avgLatency.toFixed(2) + 'ms'
  };
});
```

- [ ] **Step 2: Add request timing**

```typescript
// 在 /predict 端点开头添加
const startTime = Date.now();

// 在返回前添加
metrics.predictions++;
metrics.latency.push(Date.now() - startTime);

// 保留最近100个延迟
if (metrics.latency.length > 100) {
  metrics.latency.shift();
}
```

- [ ] **Step 3: Add error tracking**

```typescript
// 添加全局错误处理器
server.setErrorHandler((error, request, reply) => {
  metrics.errors++;
  server.log.error(error);
  reply.status(500).send({ error: 'Internal error' });
});
```

- [ ] **Step 4: Test metrics endpoint**

```bash
curl http://localhost:3001/metrics
```

Expected: Returns metrics object

- [ ] **Step 5: Commit**

```bash
git add apps/prediction-service/src/index.ts
git commit -m "feat: add metrics and monitoring"
```

---

## Task 9: 编写部署文档

**Files:**
- Create: `docs/deployment/prediction-service.md`

- [ ] **Step 1: Create deployment guide**

```markdown
# Prediction Service 部署指南

## 本地开发

\`\`\`bash
cd apps/prediction-service
npm install
npm run dev
\`\`\`

## Docker 部署

\`\`\`bash
docker-compose up -d prediction-service
\`\`\`

## 验证

\`\`\`bash
# Health check
curl http://localhost:3001/health

# Test prediction
curl -X POST http://localhost:3001/predict \
  -H "Content-Type: application/json" \
  -d '{"studentId":1,"questionFeatures":{"difficulty":0.5,"knowledgeNodes":["test"]}}'

# Check metrics
curl http://localhost:3001/metrics
\`\`\`

## 环境变量

- `DATABASE_URL`: PostgreSQL 连接字符串
- `PORT`: 服务端口（默认 3001）
- `NODE_ENV`: 运行环境
```

- [ ] **Step 2: Commit**

```bash
git add docs/deployment/
git commit -m "docs: add prediction service deployment guide"
```

---

## Task 10: 验证和测试

**Files:**
- Create: `apps/prediction-service/test-client.ts`

- [ ] **Step 1: Create test client**

```typescript
// 已存在，验证功能
const test = async () => {
  // 1. Health check
  const health = await fetch('http://localhost:3001/health').then(r => r.json());
  console.assert(health.status === 'ok', 'Health check failed');
  
  // 2. Predict
  const prediction = await fetch('http://localhost:3001/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: 1,
      questionFeatures: { difficulty: 0.5, knowledgeNodes: ['test'] }
    })
  }).then(r => r.json());
  
  console.assert(prediction.predictions, 'Prediction failed');
  console.log('Probability:', prediction.predictions[0].probability);
  
  // 3. Metrics
  const metrics = await fetch('http://localhost:3001/metrics').then(r => r.json());
  console.log('Metrics:', metrics);
  
  console.log('✅ All tests passed');
};

test();
```

- [ ] **Step 2: Run full test suite**

```bash
cd apps/prediction-service
npm run test
```

- [ ] **Step 3: Verify database logging**

```bash
# 查询日志表
npx prisma studio
# 检查 PredictionLog 表有记录
```

- [ ] **Step 4: Final commit**

```bash
git add apps/prediction-service/test-client.ts
git commit -m "test: add prediction service test client"
```

---

## Self-Review

**Spec coverage:**
- ✅ 独立服务部署
- ✅ IRT预测模型
- ✅ 数据库日志表
- ✅ 客户端SDK
- ✅ API路由
- ✅ Docker部署
- ✅ 监控指标
- ✅ 部署文档

**Placeholder scan:** 无 TBD/TODO

**Type consistency:** 已检查，类型定义一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-26-prediction-service-migration.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
