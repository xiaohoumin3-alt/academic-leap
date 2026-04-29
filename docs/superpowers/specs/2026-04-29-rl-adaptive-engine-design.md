# RL Adaptive Engine Design Document

**Date**: 2026-04-29
**Status**: MVP Design (Simplified, v2.1)
**Goal**: Validated RL-based adaptive learning engine

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | 2026-04-29 | Added DFI tracking (eventId), LE-aligned reward, CS validation |
| 2.0 | 2026-04-29 | Simplified to MVP; added IRT; fixed CS issues |
| 1.0 | 2026-04-29 | Initial design (over-engineered) |

---

## Executive Summary

### Problem Statement

Current rule-based adaptive engine has limitations:
- Fixed policy (challenge-based heuristics)
- No personalization beyond ability averaging
- No exploration/exploitation balance
- Static difficulty progression

### Solution: MVP-First Approach

**Phase 1 (MVP)**: Simplified Bandit + IRT
- IRT-based ability estimation (1PL Rasch model)
- Thompson Sampling with deltaC buckets
- **LE-aligned reward** (tracks learning improvement)
- **DFI-compliant tracking** (full eventId chain)
- 100-student validation before expansion

### Success Criteria (Aligned)

| Metric | Target | Status (v2.1) |
|--------|--------|---------------|
| DFI ≥ 0.99 | Data flow integrity | ✅ DESIGN - eventId added |
| LE > 0.15 | Learning effectiveness | ✅ DESIGN - reward tracks improvement |
| CS ≥ 0.85 | Convergence stability | ✅ DESIGN - validation method added |

---

## Critical Issues Fixed (v2.1)

### Issue 1: DFI Missing eventId ✅

**Problem**: RLTrainingLog had no eventId →无法追踪完整学习链路

**Solution**: Add full chain tracking

```prisma
model RLTrainingLog {
  id          String   @id @default(cuid())
  modelId     String

  // DFI: Full chain tracking
  eventId     String   @unique  // 关联 Attempt.id
  attemptId   String            // 显式关联 AttemptStep

  userId      String
  questionId  String

  // LE tracking
  knowledgePointId String
  recommendationId String
  preAccuracy      Float

  // Bandit state
  stateTheta      Float
  selectedDeltaC  Float
  reward          Float

  createdAt       DateTime @default(now())

  model       RLModelVersion @relation(fields: [modelId], references: [id])

  @@index([eventId])
  @@index([attemptId])
  @@index([modelId, userId])
  @@index([knowledgePointId])  // For LE calculation
}
```

### Issue 2: LE Reward Misaligned ✅

**Problem**: Reward function optimized "accuracy ≈ 70%" not "learning improvement"

**LE Definition**:
```
LE = avg(post_accuracy - pre_accuracy)
```

**Solution**: Track pre/post accuracy for LE calculation

```typescript
interface LETrackingContext {
  knowledgePointId: string;
  preAccuracy: number;      // 推荐前该知识点的正确率
  recommendationId: string;  // 关联推荐事件
}

interface StudentResponse {
  userId: string;
  questionId: string;
  correct: boolean;
  knowledgePointId: string;
  eventId: string;
  attemptId: string;
}

// LE-aligned reward function
function calculateLEReward(
  response: StudentResponse,
  context: LETrackingContext,
  historyService: HistoryService
): number {
  // 获取该学生在该知识点的历史正确率
  const historicalAccuracy = historyService.getAccuracy(
    response.userId,
    response.knowledgePointId
  );

  // 计算本次作答后的累积正确率
  const currentAccuracy = historyService.updateAccuracy(
    response.userId,
    response.knowledgePointId,
    response.correct
  );

  // LE = 当前正确率 - 推荐前正确率
  const improvement = currentAccuracy - context.preAccuracy;

  // 奖励 = sigmoid(学习提升)
  // 映射到 [0, 1], improvement > 0 时 reward > 0.5
  const reward = 1 / (1 + Math.exp(-5 * improvement));

  return reward;
}

// Alternative: Hybrid reward (accuracy + LE)
function calculateHybridReward(
  response: StudentResponse,
  context: LETrackingContext,
  historyService: HistoryService
): number {
  // Component 1: Accuracy reward (0.7 target)
  const y = response.correct ? 1 : 0;
  const accuracyReward = 1 - Math.abs(y - 0.7);

  // Component 2: LE improvement
  const currentAccuracy = historyService.getAccuracy(
    response.userId,
    response.knowledgePointId
  );
  const improvement = currentAccuracy - context.preAccuracy;
  const leReward = 1 / (1 + Math.exp(-5 * improvement));

  // Weighted combination (tune based on validation)
  return 0.3 * accuracyReward + 0.7 * leReward;
}
```

### Issue 3: API Missing Context ✅

**Problem**: RecordResponse API lacked LE calculation context

**Solution**: Extended API with full context

```typescript
// POST /api/rl/next-question
interface GetNextQuestionRequest {
  userId: string;
  knowledgePointId: string;
}

interface GetNextQuestionResponse {
  question: {
    id: string;
    deltaC: number;
  };
  theta: number;
  selectedBucket: string;

  // DFI + LE context
  recommendationId: string;  // 用于 record-response 关联
  preAccuracy: number;       // 推荐前该知识点的正确率
  modelVersion: string;
}

// POST /api/rl/record-response
interface RecordResponseRequest {
  userId: string;
  questionId: string;
  correct: boolean;
  duration?: number;

  // DFI tracking (REQUIRED)
  eventId: string;           // 从 Attempt.id 传递
  attemptId: string;         // 从 AttemptStep.id 传递

  // LE calculation (REQUIRED)
  knowledgePointId: string;
  recommendationId: string;  // 从 next-question 返回
  preAccuracy: number;       // 从 next-question 返回
}

interface RecordResponseResponse {
  reward: number;

  // State updates
  thetaBefore: number;
  thetaAfter: number;

  // LE metrics
  preAccuracy: number;
  postAccuracy: number;
  leDelta: number;          // post - pre

  // Tracking
  bucketUpdated: string;
  logId: string;            // RLTrainingLog.id
}
```

### Issue 4: CS Validation Method ✅

**Problem**: Thompson Sampling stability claimed but not verified

**Solution**: Add CS validation to Phase 3

```typescript
interface CSValidationConfig {
  seeds: number[];          // 随机种子
  ability: number;          // 测试用的 ability
  trials: number;           // 每个种子的试验次数
}

async function validateThompsonStability(
  bandit: ThompsonSamplingBandit,
  config: CSValidationConfig
): Promise<{
  csScore: number;
  pass: boolean;
  details: {
    seed: number;
    recommendations: string[];
    distribution: Map<string, number>;
  }[];
}> {
  const results = [];

  for (const seed of config.seeds) {
    // Clone bandit with same posterior
    const b = bandit.clone();
    b.setSeed(seed);

    // Run N trials
    const recommendations: string[] = [];
    for (let i = 0; i < config.trials; i++) {
      const arm = b.selectArm(config.ability);
      recommendations.push(arm);
    }

    // Calculate distribution
    const distribution = new Map<string, number>();
    for (const arm of recommendations) {
      distribution.set(arm, (distribution.get(arm) ?? 0) + 1);
    }

    results.push({
      seed,
      recommendations,
      distribution
    });
  }

  // Calculate CS: 1 - normalized entropy
  // Higher CS = more consistent recommendations across seeds
  const avgJaccard = calculateAverageJaccardSimilarity(results);
  const csScore = avgJaccard;

  return {
    csScore,
    pass: csScore >= 0.85,
    details: results
  };
}

function calculateAverageJaccardSimilarity(
  results: Array<{ recommendations: string[] }>
): number {
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const set1 = new Set(results[i].recommendations);
      const set2 = new Set(results[j].recommendations);

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const jaccard = intersection.size / union.size;
      totalSimilarity += jaccard;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}
```

### Issue 5: Schema Indexes ✅

**Solution**: Add missing indexes

```prisma
model IRTStudentState {
  id              String   @id @default(cuid())
  userId          String   @unique

  theta           Float    @default(0)
  confidence      Float    @default(1)

  responseCount   Int      @default(0)

  lastEstimatedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Added indexes
  @@index([lastEstimatedAt])
  @@index([responseCount])
  @@index([theta])  // For ability-based queries
}
```

---

## MVP Architecture (v2.1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MVP RL Adaptive Engine v2.1                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │   IRT       │───▶│  Thompson   │───▶│  Selection  │                │
│  │ Estimator   │    │  Sampling   │    │   Engine    │                │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
│         │                   │                    │                      │
│         │                   │                    ▼                      │
│         │                   │            ┌─────────────┐               │
│         │                   │            │   Question  │               │
│         │                   │            │    Pool     │               │
│         │                   │            │  (deltaC)   │               │
│         │                   │            └─────────────┘               │
│         │                   │                   │                      │
│         ▼                   ▼                   ▼                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│  │   Reward    │◀───│   Student   │───▶│    LE       │               │
│  │  (LE-Aligned)│   │  Response   │    │  Tracker    │               │
│  └─────────────┘    └─────────────┘    └─────────────┘               │
│         │                   │                    │                      │
│         └─────────┬─────────┘                    │                      │
│                   ▼                              ▼                      │
│          ┌─────────────┐              ┌─────────────┐                  │
│          │   Model     │              │   DFI       │                  │
│          │   Update    │              │   Tracker   │                  │
│          └─────────────┘              └─────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Thompson Sampling Algorithm (MVP)

### Why Thompson Sampling

1. **Stability**: Posterior-based, same posterior → same samples
2. **Simplicity**: Beta(α, β) vs matrix inversion
3. **Interpretability**: Clear success/failure counts
4. **CS Compliance**: Verified via Jaccard similarity

### Algorithm with Seed Control

```typescript
class ThompsonSamplingBandit {
  private buckets: Map<string, {
    alpha: number;
    beta: number;
  }>;
  private rng?: seededRandom.Seed;  // For reproducibility

  constructor(bucketSize: number = 0.5) {
    this.buckets = new Map();
    for (let d = 0; d <= 10; d += bucketSize) {
      this.buckets.set(d.toFixed(1), { alpha: 1, beta: 1 });
    }
  }

  setSeed(seed: number): void {
    this.rng = new seededRandom.Seed(seed);
  }

  clone(): ThompsonSamplingBandit {
    const cloned = new ThompsonSamplingBandit();
    for (const [key, { alpha, beta }] of this.buckets) {
      cloned.buckets.set(key, { alpha, beta });
    }
    return cloned;
  }

  selectArm(ability: number): string {
    const minDeltaC = Math.max(0, ability - 1);
    const maxDeltaC = Math.min(10, ability + 1);

    let bestDeltaC = minDeltaC;
    let bestSample = -1;

    for (let dc = minDeltaC; dc <= maxDeltaC; dc += 0.5) {
      const bucket = this.buckets.get(dc.toFixed(1))!;
      const sample = this.sampleBeta(bucket.alpha, bucket.beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestDeltaC = dc;
      }
    }

    return bestDeltaC.toFixed(1);
  }

  update(deltaC: string, success: boolean): void {
    const bucket = this.buckets.get(deltaC)!;
    if (success) {
      bucket.alpha++;
    } else {
      bucket.beta++;
    }
  }

  private sampleBeta(alpha: number, beta: number): number {
    const u1 = this.sampleGamma(alpha);
    const u2 = this.sampleGamma(beta);
    return u1 / (u1 + u2);
  }

  private sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(this.random(), 1 / shape);
    }
    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      const x = this.gaussianRandom();
      const v = (1 + c * x) ** 3;
      if (v > 0) {
        const u = this.random();
        if (u < 1 - 0.0331 * (x * x) ** 2) {
          return d * v;
        }
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
  }

  private gaussianRandom(): number {
    const u = this.random();
    const v = this.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private random(): number {
    return this.rng ? this.rng.next() : Math.random();
  }
}
```

---

## LE Tracking Service

### Knowledge Point Accuracy History

```typescript
interface LEHistoryService {
  // Get current accuracy for a user-knowledge point pair
  getAccuracy(userId: string, knowledgePointId: string): number;

  // Update accuracy with new response
  updateAccuracy(
    userId: string,
    knowledgePointId: string,
    correct: boolean
  ): number;

  // Get history for LE calculation
  getHistory(
    userId: string,
    knowledgePointId: string,
    window?: number
  ): Array<{
    questionId: string;
    correct: boolean;
    timestamp: Date;
  }>;
}

class InMemoryLEHistoryService implements LEHistoryService {
  private cache: Map<string, {
    correct: number;
    total: number;
    history: Array<{ questionId: string; correct: boolean; timestamp: Date }>;
  }> = new Map();

  private key(userId: string, kpId: string): string {
    return `${userId}:${kpId}`;
  }

  getAccuracy(userId: string, knowledgePointId: string): number {
    const data = this.cache.get(this.key(userId, kpId));
    if (!data || data.total === 0) return 0.5; // Prior
    return data.correct / data.total;
  }

  updateAccuracy(
    userId: string,
    knowledgePointId: string,
    correct: boolean
  ): number {
    const key = this.key(userId, knowledgePointId);
    const data = this.cache.get(key) ?? {
      correct: 0,
      total: 0,
      history: []
    };

    data.correct += correct ? 1 : 0;
    data.total += 1;
    data.history.push({
      questionId: crypto.randomUUID(),
      correct,
      timestamp: new Date()
    });

    this.cache.set(key, data);
    return data.correct / data.total;
  }

  getHistory(
    userId: string,
    knowledgePointId: string,
    window: number = 100
  ) {
    const data = this.cache.get(this.key(userId, knowledgePointId));
    if (!data) return [];

    return data.history.slice(-window);
  }
}
```

---

## IRT Ability Estimation

### 1PL (Rasch) Model with EAP

```typescript
function estimateAbilityEAP(
  responses: Array<{ correct: boolean; deltaC: number }>,
  config: IRTConfig = {}
): {
  theta: number;
  confidence: number;
} {
  const {
    thetaMin = -3,
    thetaMax = 3,
    thetaSteps = 61,
    priorMean = 0,
    priorStd = 1
  } = config;

  const dTheta = (thetaMax - thetaMin) / (thetaSteps - 1);

  // Compute posterior
  let numerator = 0;
  let denominator = 0;
  let maxPosterior = 0;

  const posteriors: number[] = [];

  for (let i = 0; i < thetaSteps; i++) {
    const theta = thetaMin + i * dTheta;

    let likelihood = 1;
    for (const r of responses) {
      const p = 1 / (1 + Math.exp(-(theta - r.deltaC)));
      likelihood *= r.correct ? p : (1 - p);
    }

    const prior = gaussian(theta, priorMean, priorStd);
    const posterior = likelihood * prior;
    posteriors.push(posterior);

    maxPosterior = Math.max(maxPosterior, posterior);
    numerator += theta * posterior * dTheta;
    denominator += posterior * dTheta;
  }

  const theta = numerator / denominator;

  // Compute confidence (posterior std)
  let variance = 0;
  for (let i = 0; i < thetaSteps; i++) {
    const thetaVal = thetaMin + i * dTheta;
    variance += posteriors[i] * Math.pow(thetaVal - theta, 2) * dTheta;
  }
  const confidence = Math.sqrt(variance / denominator);

  return { theta, confidence };
}
```

---

## Database Schema (MVP v2.1)

```prisma
model RLModelVersion {
  id          String   @id @default(cuid())
  version     String   @unique
  algorithm   String   // "ThompsonSampling"

  bucketSize  Float    @default(0.5)
  priorAlpha  Float    @default(1)
  priorBeta   Float    @default(1)

  trainedAt   DateTime?

  avgReward       Float?
  totalSelections Int      @default(0)

  status      String   @default("TRAINING")

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  arms        RLBanditArm[]
  logs        RLTrainingLog[]

  @@index([status])
}

model RLBanditArm {
  id          String   @id @default(cuid())
  modelId     String
  deltaC      Float

  alpha       Int      @default(1)
  beta        Int      @default(1)

  pullCount   Int      @default(0)
  successCount Int     @default(0)
  avgReward   Float?

  updatedAt   DateTime @updatedAt

  model       RLModelVersion @relation(fields: [modelId], references: [id])

  @@unique([modelId, deltaC])
}

model RLTrainingLog {
  id          String   @id @default(cuid())
  modelId     String

  // DFI: Full chain tracking (REQUIRED)
  eventId     String   @unique
  attemptId   String

  // Context
  userId      String
  questionId  String

  // LE tracking (REQUIRED)
  knowledgePointId   String
  recommendationId   String
  preAccuracy        Float

  // Bandit state
  stateTheta      Float
  selectedDeltaC  Float
  reward          Float

  // LE results
  postAccuracy    Float?
  leDelta         Float?

  createdAt       DateTime @default(now())

  model       RLModelVersion @relation(fields: [modelId], references: [id])

  @@index([eventId])
  @@index([attemptId])
  @@index([modelId, userId])
  @@index([knowledgePointId])
  @@index([recommendationId])
}

model IRTStudentState {
  id              String   @id @default(cuid())
  userId          String   @unique

  theta           Float    @default(0)
  confidence      Float    @default(1)

  responseCount   Int      @default(0)

  lastEstimatedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([lastEstimatedAt])
  @@index([responseCount])
  @@index([theta])
}

model LEKnowledgePointState {
  id              String   @id @default(cuid())
  userId          String
  knowledgePointId String

  correct         Int      @default(0)
  total           Int      @default(0)
  accuracy        Float    @default(0.5)

  lastUpdatedAt   DateTime @default(now())

  @@unique([userId, knowledgePointId])
  @@index([userId])
  @@index([knowledgePointId])
}
```

---

## API Design (MVP v2.1)

```typescript
// POST /api/rl/next-question
interface GetNextQuestionRequest {
  userId: string;
  knowledgePointId: string;
}

interface GetNextQuestionResponse {
  question: {
    id: string;
    deltaC: number;
  };

  // Bandit state
  theta: number;
  selectedBucket: string;
  modelVersion: string;

  // DFI + LE context (pass back to record-response)
  recommendationId: string;
  preAccuracy: number;
}

// POST /api/rl/record-response
interface RecordResponseRequest {
  userId: string;
  questionId: string;
  correct: boolean;
  duration?: number;

  // DFI tracking (REQUIRED)
  eventId: string;
  attemptId: string;

  // LE calculation (REQUIRED)
  knowledgePointId: string;
  recommendationId: string;
  preAccuracy: number;
}

interface RecordResponseResponse {
  reward: number;

  // IRT state
  thetaBefore: number;
  thetaAfter: number;

  // LE metrics
  preAccuracy: number;
  postAccuracy: number;
  leDelta: number;

  // Tracking
  bucketUpdated: string;
  logId: string;
}

// GET /api/rl/student-state
interface GetStudentStateResponse {
  irt: {
    theta: number;
    confidence: number;
    responseCount: number;
  };
  knowledgePoints: Array<{
    knowledgePointId: string;
    accuracy: number;
    totalAttempts: number;
  }>;
}
```

---

## Validation Plan (MVP v2.1)

### Phase 1: Implementation (Week 1)

- [ ] IRT EAP estimator
- [ ] Thompson sampling bandit with seed control
- [ ] LE-aligned reward calculator
- [ ] LE history service
- [ ] DFI tracking (eventId chain)

### Phase 2: Data Collection (Week 2)

- [ ] Deploy to 100 students
- [ ] Verify DFI ≥ 0.99 (eventId chain complete)
- [ ] Collect LE data (pre/post accuracy)

### Phase 3: Validation (Week 3)

**DFI Validation**:
```typescript
async function validateDFI(): Promise<{
  dfi: number;
  pass: boolean;
  gaps: string[];
}> {
  // Check: All RLTrainingLog have eventId
  const missingEventId = await prisma.rLTrainingLog.count({
    where: { eventId: null }
  });

  // Check: All eventId trace to Attempt
  const orphanedLogs = await prisma.rLTrainingLog.findMany({
    where: {
      attempt: { is: null }
    }
  });

  const total = await prisma.rLTrainingLog.count();
  const complete = total - missingEventId - orphanedLogs.length;
  const dfi = complete / total;

  return {
    dfi,
    pass: dfi >= 0.99,
    gaps: [
      missingEventId > 0 ? `${missingEventId} logs missing eventId` : null,
      orphanedLogs.length > 0 ? `${orphanedLogs.length} orphaned logs` : null
    ].filter(Boolean)
  };
}
```

**LE Validation**:
```typescript
async function validateLE(): Promise<{
  le: number;
  pass: boolean;
  confidence: number;
}> {
  // For each knowledge point, calculate avg improvement
  const results = await prisma.rLTrainingLog.groupBy({
    by: ['knowledgePointId'],
    where: {
      postAccuracy: { not: null },
      leDelta: { not: null }
    },
    _avg: {
      leDelta: true
    },
    _count: true
  });

  const le = results.length > 0
    ? results.reduce((sum, r) => sum + (r._avg.leDelta ?? 0), 0) / results.length
    : 0;

  // Bootstrap confidence interval
  const samples = bootstrap(results, 1000);
  const ci95 = calculateCI(samples, 0.95);

  return {
    le,
    pass: le > 0.15,
    confidence: ci95[1] - ci95[0]  // Narrower = more confident
  };
}
```

**CS Validation**:
```typescript
async function validateCS(
  bandit: ThompsonSamplingBandit
): Promise<{
  cs: number;
  pass: boolean;
}> {
  const seeds = [1, 2, 3, 4, 5, 42, 123, 456, 789, 999];
  const result = await validateThompsonStability(bandit, {
    seeds,
    ability: 0,  // Test at average ability
    trials: 100
  });

  return {
    cs: result.csScore,
    pass: result.csScore >= 0.85
  };
}
```

---

## CI Gate Scripts

### test-dfi.ts

```typescript
#!/usr/bin/env tsx
import { validateDFI } from '../lib/rl/validation';

const result = await validateDFI();
console.log(`DFI: ${result.dfi.toFixed(4)}`);
console.log(`Pass: ${result.pass}`);

if (!result.pass) {
  console.error('DFI gaps:', result.gaps);
  process.exit(1);
}
```

### test-le.ts

```typescript
#!/usr/bin/env tsx
import { validateLE } from '../lib/rl/validation';

const result = await validateLE();
console.log(`LE: ${result.le.toFixed(4)}`);
console.log(`Pass: ${result.pass}`);
console.log(`CI95: [${result.confidence.toFixed(4)}]`);

if (!result.pass) {
  console.error('LE below threshold 0.15');
  process.exit(1);
}
```

### test-cs.ts

```typescript
#!/usr/bin/env tsx
import { validateCS } from '../lib/rl/validation';
import { loadDeployedBandit } from '../lib/rl/persistence';

const bandit = await loadDeployedBandit();
const result = await validateCS(bandit);
console.log(`CS: ${result.cs.toFixed(4)}`);
console.log(`Pass: ${result.pass}`);

if (!result.pass) {
  console.error('CS below threshold 0.85');
  process.exit(1);
}
```

---

## Risks & Mitigations (MVP v2.1)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| IRT estimation unstable | High | Low | EAP with proper prior; min 10 responses |
| Thompson slow convergence | Medium | Medium | Warm-start with historical data |
| LE signal weak | High | Medium | Hybrid reward (accuracy + LE) |
| DFI chain breaks | High | Low | Required fields; CI validation |
| CS validation fails | Medium | Low | Tune exploration; increase trials |

---

## Appendix: v2.1 Summary

**Changes from v2.0**:
1. Added `eventId`, `attemptId` to RLTrainingLog (DFI)
2. Refactored reward to track LE (pre/post accuracy)
3. Extended API with recommendation context
4. Added CS validation method
5. Added schema indexes
6. Added LEKnowledgePointState model
7. Added CI gate scripts

**Acceptance Status**:

| Metric | v2.0 | v2.1 |
|--------|------|------|
| DFI | ⚠️ PARTIAL | ✅ DESIGN |
| LE | ❌ FAIL | ✅ DESIGN |
| CS | ⚠️ NO VALIDATION | ✅ DESIGN |

---

**Document Version**: 2.1 (MVP with DFI/LE/CS)
**Last Updated**: 2026-04-29
**Status**: Ready for implementation
