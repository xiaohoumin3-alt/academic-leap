# Effect Validation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a system to validate whether AI-generated templates actually improve student learning outcomes, with Shadow Mode data collection, A/B testing, Canary rollout, and graceful degradation.

**Architecture:** Multi-layer pipeline: ShadowCollector gathers baseline data → ExperimentManager runs A/B tests → CanaryController manages gradual rollout → LEAnalyzer computes learning effectiveness → GracefulDegrader handles anomalies.

**Tech Stack:** Next.js 15 API Routes, Prisma ORM, existing RL/LE validation modules

---

## File Structure

```
lib/effect-validation/
├── types.ts                    # Shared type definitions
├── shadow-collector.ts         # Shadow mode data collection
├── experiment-manager.ts        # A/B experiment management
├── canary-controller.ts        # Canary rollout control
├── le-analyzer.ts              # Learning effectiveness analysis
├── graceful-degrader.ts        # Graceful degradation logic
├── index.ts                    # Barrel export
└── __tests__/
    ├── shadow-collector.test.ts
    ├── experiment-manager.test.ts
    ├── canary-controller.test.ts
    ├── le-analyzer.test.ts
    └── graceful-degrader.test.ts

app/api/effect-validation/
├── dashboard/route.ts           # GET dashboard data
├── experiments/route.ts        # POST/GET experiments
├── experiments/[id]/route.ts   # GET/PATCH experiment
├── experiments/[id]/results/route.ts  # GET experiment results
├── canaries/route.ts           # GET/POST canaries
├── canaries/[templateId]/route.ts  # GET canary status
├── canaries/[templateId]/increase/route.ts  # POST increase traffic
├── canaries/[templateId]/rollback/route.ts  # POST rollback
├── le/route.ts                 # GET global LE
└── le/[knowledgePointId]/route.ts  # GET KP-specific LE

prisma/schema.prisma            # Add new tables
```

---

## Task 1: Database Schema Extensions

**Files:**
- Modify: `prisma/schema.prisma`

**Purpose:** Add tables for shadow attempts, effect experiments, canary releases.

- [ ] **Step 1: Add ShadowAttempt model**

```prisma
model ShadowAttempt {
  id            String   @id @default(cuid())
  templateId    String
  userId        String
  knowledgePoint String
  isCorrect     Boolean
  duration      Int      // seconds
  leDelta       Float?
  recordedAt    DateTime @default(now())

  @@index([templateId])
  @@index([knowledgePoint])
  @@index([userId])
}
```

- [ ] **Step 2: Add EffectExperiment models**

```prisma
model EffectExperiment {
  id                 String   @id @default(cuid())
  name               String
  controlTemplateId  String
  treatmentTemplateId String
  status             String   @default("draft")
  targetMetric       String   // 'accuracy' | 'le'
  minSampleSize      Int      @default(50)
  startedAt          DateTime?
  completedAt        DateTime?
  createdAt          DateTime @default(now())

  assignments     EffectAssignment[]
  observations    EffectObservation[]

  @@index([status])
}

model EffectAssignment {
  id            String   @id @default(cuid())
  experimentId  String
  userId        String
  variant       String   // 'control' | 'treatment'
  assignedAt    DateTime @default(now())

  experiment    EffectExperiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)

  @@unique([experimentId, userId])
}

model EffectObservation {
  id            String   @id @default(cuid())
  experimentId  String
  userId        String
  variant       String
  metricName    String
  value         Float
  timestamp     DateTime @default(now())

  experiment    EffectExperiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)

  @@index([experimentId, variant])
}
```

- [ ] **Step 3: Add CanaryRelease models**

```prisma
model CanaryRelease {
  id              String   @id @default(cuid())
  templateId      String   @unique
  currentStage   Int      @default(0)
  trafficPercent  Int     @default(0)
  status          String   @default("pending")
  startedAt       DateTime?
  lastHealthCheck DateTime?
  healthStatus    String?
  createdAt       DateTime @default(now())

  history        CanaryStageHistory[]

  @@index([templateId])
  @@index([status])
}

model CanaryStageHistory {
  id              String   @id @default(cuid())
  canaryId        String
  stage           Int
  trafficPercent  Int
  enteredAt       DateTime @default(now())
  exitedAt        DateTime?
  leValue         Float?
  accuracyValue   Float?

  canary          CanaryRelease @relation(fields: [canaryId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/seanxx/academic-leap/academic-leap
pnpm prisma migrate dev --name add_effect_validation_tables
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add effect validation database tables"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `lib/effect-validation/types.ts`

**Purpose:** Centralized types for the effect validation system.

- [ ] **Step 1: Write types**

```typescript
// lib/effect-validation/types.ts

// ============================================================================
// Shadow Mode
// ============================================================================

export interface ShadowAttempt {
  id: string;
  templateId: string;
  userId: string;
  knowledgePoint: string;
  isCorrect: boolean;
  duration: number;
  leDelta?: number;
  recordedAt: Date;
}

// ============================================================================
// Experiment
// ============================================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type Variant = 'control' | 'treatment';
export type TargetMetric = 'accuracy' | 'le';

export interface ExperimentConfig {
  name: string;
  controlTemplateId: string;
  treatmentTemplateId: string;
  targetMetric: TargetMetric;
  minSampleSize: number;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  userId: string;
  variant: Variant;
  assignedAt: Date;
}

export interface Observation {
  id: string;
  experimentId: string;
  userId: string;
  variant: Variant;
  metricName: string;
  value: number;
  timestamp: Date;
}

export interface ExperimentResult {
  controlMean: number;
  controlSample: number;
  treatmentMean: number;
  treatmentSample: number;
  uplift: number;
  pValue: number;
  significant: boolean;
  recommendation: 'promote' | 'demote' | 'need_more_data';
}

// ============================================================================
// Canary
// ============================================================================

export type CanaryStatus = 'pending' | 'running' | 'paused' | 'completed' | 'rolled_back';
export type HealthStatus = 'healthy' | 'warning' | 'danger';

export const CANARY_STAGES = [5, 10, 25, 50, 100];
export const STAGE_DURATION_HOURS = 24;

export interface CanaryRelease {
  id: string;
  templateId: string;
  currentStage: number;
  trafficPercent: number;
  status: CanaryStatus;
  startedAt?: Date;
  lastHealthCheck?: Date;
  healthStatus?: HealthStatus;
}

export interface CanaryStageHistory {
  id: string;
  canaryId: string;
  stage: number;
  trafficPercent: number;
  enteredAt: Date;
  exitedAt?: Date;
  leValue?: number;
  accuracyValue?: number;
}

// ============================================================================
// LE Analysis
// ============================================================================

export type Trend = 'improving' | 'stable' | 'declining';

export interface LEResult {
  knowledgePointId: string;
  le: number;
  confidence: number;
  sampleSize: number;
  trend: Trend;
}

export interface GlobalLEResult {
  le: number;
  confidence: number;
  trend: Trend;
  byKnowledgePoint: LEResult[];
}

// ============================================================================
// Degradation
// ============================================================================

export type Severity = 'warning' | 'danger' | 'critical';
export type Strategy = 'rl' | 'rule_engine';

export interface DegradationRule {
  severity: Severity;
  action: 'increase_exploration' | 'switch_to_rule_engine' | 'immediate_rollback';
  description: string;
}

export interface DegradationStatus {
  templateId: string;
  status: 'healthy' | 'warning' | 'degraded' | 'stopped';
  currentStrategy: Strategy;
  degradationReason?: string;
  degradedAt?: Date;
}

// ============================================================================
// Dashboard
// ============================================================================

export interface ValidationDashboard {
  activeCanaries: CanaryRelease[];
  activeExperiments: Array<{
    id: string;
    name: string;
    status: ExperimentStatus;
    progress: number;
  }>;
  globalLE: GlobalLEResult;
  anomalies: AnomalyReport[];
}

export interface AnomalyReport {
  type: 'le_drop' | 'accuracy_drop' | 'variance_spike';
  severity: Severity;
  details: {
    metric: string;
    expected: number;
    actual: number;
    deviation: number;
  };
  detectedAt: Date;
}
```

- [ ] **Step 2: Create barrel export**

```bash
mkdir -p lib/effect-validation
```

```typescript
// lib/effect-validation/index.ts
export * from './types';
```

- [ ] **Step 3: Commit**

```bash
git add lib/effect-validation/types.ts lib/effect-validation/index.ts
git commit -m "feat: add effect validation type definitions"
```

---

## Task 3: ShadowCollector

**Files:**
- Create: `lib/effect-validation/shadow-collector.ts`
- Create: `lib/effect-validation/__tests__/shadow-collector.test.ts`

**Purpose:** Collect data in shadow mode without affecting live recommendations.

- [ ] **Step 1: Write tests**

```typescript
// lib/effect-validation/__tests__/shadow-collector.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { ShadowCollector } from '../shadow-collector';

vi.mock('@prisma/client');

describe('ShadowCollector', () => {
  let collector: ShadowCollector;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      shadowAttempt: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    collector = new ShadowCollector(mockPrisma);
  });

  it('should record shadow attempt', async () => {
    mockPrisma.shadowAttempt.create.mockResolvedValueOnce({
      id: 'sa-1',
      templateId: 't-1',
      userId: 'u-1',
    });

    await collector.recordShadowAttempt({
      templateId: 't-1',
      userId: 'u-1',
      knowledgePoint: 'kp-1',
      isCorrect: true,
      duration: 30,
    });

    expect(mockPrisma.shadowAttempt.create).toHaveBeenCalled();
  });

  it('should check if ready for analysis', async () => {
    mockPrisma.shadowAttempt.count.mockResolvedValueOnce(50);

    const ready = await collector.isReadyForAnalysis('t-1');
    expect(ready).toBe(true);
  });

  it('should return false when insufficient samples', async () => {
    mockPrisma.shadowAttempt.count.mockResolvedValueOnce(30);

    const ready = await collector.isReadyForAnalysis('t-1');
    expect(ready).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/effect-validation/__tests__/shadow-collector.test.ts
```

Expected: FAIL - "ShadowCollector is not defined"

- [ ] **Step 3: Implement ShadowCollector**

```typescript
// lib/effect-validation/shadow-collector.ts
import type { ShadowAttempt } from './types';
import type { PrismaClient } from '@prisma/client';

const MIN_SAMPLES_FOR_ANALYSIS = 50;

export class ShadowCollector {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addToShadowPool(templateId: string): Promise<void> {
    // Templates start in shadow pool automatically
    // This is for tracking purposes
    await this.prisma.canaryRelease.upsert({
      where: { templateId },
      create: {
        templateId,
        status: 'pending',
        trafficPercent: 0,
      },
      update: {},
    });
  }

  async recordShadowAttempt(data: Omit<ShadowAttempt, 'id' | 'recordedAt'>): Promise<void> {
    await this.prisma.shadowAttempt.create({
      data: {
        templateId: data.templateId,
        userId: data.userId,
        knowledgePoint: data.knowledgePoint,
        isCorrect: data.isCorrect,
        duration: data.duration,
        leDelta: data.leDelta,
      },
    });
  }

  async getSampleCount(templateId: string): Promise<number> {
    return this.prisma.shadowAttempt.count({
      where: { templateId },
    });
  }

  async isReadyForAnalysis(templateId: string): Promise<boolean> {
    const count = await this.getSampleCount(templateId);
    return count >= MIN_SAMPLES_FOR_ANALYSIS;
  }

  async getShadowAttempts(
    templateId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ShadowAttempt[]> {
    const attempts = await this.prisma.shadowAttempt.findMany({
      where: { templateId },
      orderBy: { recordedAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });

    return attempts.map(a => ({
      id: a.id,
      templateId: a.templateId,
      userId: a.userId,
      knowledgePoint: a.knowledgePoint,
      isCorrect: a.isCorrect,
      duration: a.duration,
      leDelta: a.leDelta ?? undefined,
      recordedAt: a.recordedAt,
    }));
  }

  async calculateAccuracy(templateId: string): Promise<{ accuracy: number; sample: number }> {
    const attempts = await this.prisma.shadowAttempt.findMany({
      where: { templateId },
      select: { isCorrect: true },
    });

    if (attempts.length === 0) {
      return { accuracy: 0, sample: 0 };
    }

    const correct = attempts.filter(a => a.isCorrect).length;
    return {
      accuracy: correct / attempts.length,
      sample: attempts.length,
    };
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/effect-validation/__tests__/shadow-collector.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/effect-validation/shadow-collector.ts
git commit -m "feat: add ShadowCollector for shadow mode data collection"
```

---

## Task 4: ExperimentManager

**Files:**
- Create: `lib/effect-validation/experiment-manager.ts`
- Create: `lib/effect-validation/__tests__/experiment-manager.test.ts`

**Purpose:** Manage A/B experiments with statistical significance testing.

- [ ] **Step 1: Write tests**

```typescript
// lib/effect-validation/__tests__/experiment-manager.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { ExperimentManager } from '../experiment-manager';

vi.mock('@prisma/client');

describe('ExperimentManager', () => {
  let manager: ExperimentManager;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      effectExperiment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      effectAssignment: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      effectObservation: {
        create: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    manager = new ExperimentManager(mockPrisma);
  });

  it('should create experiment', async () => {
    mockPrisma.effectExperiment.create.mockResolvedValueOnce({
      id: 'exp-1',
      name: 'Test Experiment',
      status: 'draft',
    });

    const id = await manager.createExperiment({
      name: 'Test Experiment',
      controlTemplateId: 'ctrl-1',
      treatmentTemplateId: 'treat-1',
      targetMetric: 'accuracy',
      minSampleSize: 50,
    });

    expect(id).toBe('exp-1');
  });

  it('should assign variant deterministically', async () => {
    const v1 = await manager.assignVariant('user-1', 'exp-1');
    const v2 = await manager.assignVariant('user-1', 'exp-1');

    // Same user should get same variant
    expect(v1).toBe(v2);
  });

  it('should analyze experiment with significant results', async () => {
    mockPrisma.effectObservation.groupBy.mockResolvedValueOnce([
      { variant: 'control', _avg: { value: 0.7 }, _count: 60 },
      { variant: 'treatment', _avg: { value: 0.85 }, _count: 55 },
    ]);

    const result = await manager.analyzeExperiment('exp-1');

    expect(result.significant).toBe(true);
    expect(result.uplift).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/effect-validation/__tests__/experiment-manager.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement ExperimentManager**

```typescript
// lib/effect-validation/experiment-manager.ts
import type { ExperimentConfig, ExperimentResult, Variant } from './types';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class ExperimentManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createExperiment(config: ExperimentConfig): Promise<string> {
    const experiment = await this.prisma.effectExperiment.create({
      data: {
        name: config.name,
        controlTemplateId: config.controlTemplateId,
        treatmentTemplateId: config.treatmentTemplateId,
        targetMetric: config.targetMetric,
        minSampleSize: config.minSampleSize,
        status: 'draft',
      },
    });
    return experiment.id;
  }

  async assignVariant(userId: string, experimentId: string): Promise<Variant> {
    // Check if already assigned
    const existing = await this.prisma.effectAssignment.findUnique({
      where: {
        experimentId_userId: { experimentId, userId },
      },
    });

    if (existing) {
      return existing.variant as Variant;
    }

    // Deterministic assignment based on hash
    const hash = simpleHash(`${experimentId}:${userId}`);
    const variant: Variant = hash % 2 === 0 ? 'control' : 'treatment';

    await this.prisma.effectAssignment.create({
      data: {
        experimentId,
        userId,
        variant,
      },
    });

    return variant;
  }

  async recordObservation(data: {
    experimentId: string;
    userId: string;
    variant: Variant;
    metricName: string;
    value: number;
  }): Promise<void> {
    await this.prisma.effectObservation.create({
      data: {
        experimentId: data.experimentId,
        userId: data.userId,
        variant: data.variant,
        metricName: data.metricName,
        value: data.value,
      },
    });
  }

  async analyzeExperiment(experimentId: string): Promise<ExperimentResult> {
    const experiment = await this.prisma.effectExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const observations = await this.prisma.effectObservation.groupBy({
      by: ['variant'],
      where: { experimentId },
      _avg: { value: true },
      _count: true,
    });

    const controlObs = observations.find(o => o.variant === 'control');
    const treatmentObs = observations.find(o => o.variant === 'treatment');

    const controlMean = controlObs?._avg.value ?? 0;
    const treatmentMean = treatmentObs?._avg.value ?? 0;
    const controlSample = controlObs?._count ?? 0;
    const treatmentSample = treatmentObs?._count ?? 0;

    const uplift = controlMean > 0
      ? ((treatmentMean - controlMean) / controlMean) * 100
      : 0;

    // Simple p-value approximation (would use proper stats library in production)
    const pValue = this.calculatePValue(controlMean, treatmentMean, controlSample, treatmentSample);
    const significant = pValue < 0.05 && treatmentMean > controlMean;

    let recommendation: 'promote' | 'demote' | 'need_more_data';
    if (!significant && (controlSample < experiment.minSampleSize || treatmentSample < experiment.minSampleSize)) {
      recommendation = 'need_more_data';
    } else if (significant && treatmentMean > controlMean) {
      recommendation = 'promote';
    } else {
      recommendation = 'demote';
    }

    return {
      controlMean,
      controlSample,
      treatmentMean,
      treatmentSample,
      uplift,
      pValue,
      significant,
      recommendation,
    };
  }

  private calculatePValue(
    controlMean: number,
    treatmentMean: number,
    controlSample: number,
    treatmentSample: number
  ): number {
    // Simplified p-value calculation
    // In production, use a proper stats library
    const diff = Math.abs(treatmentMean - controlMean);
    const pooledSE = Math.sqrt((0.25 / controlSample) + (0.25 / treatmentSample));

    if (pooledSE === 0) return 1;

    const z = diff / pooledSE;
    // Approximate p-value from z-score
    return Math.max(0.001, Math.min(1, 2 * (1 - this.normalCDF(z))));
  }

  private normalCDF(z: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  async startExperiment(experimentId: string): Promise<void> {
    await this.prisma.effectExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });
  }

  async completeExperiment(experimentId: string): Promise<void> {
    await this.prisma.effectExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/effect-validation/__tests__/experiment-manager.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/effect-validation/experiment-manager.ts
git commit -m "feat: add ExperimentManager for A/B testing"
```

---

## Task 5: CanaryController

**Files:**
- Create: `lib/effect-validation/canary-controller.ts`
- Create: `lib/effect-validation/__tests__/canary-controller.test.ts`

**Purpose:** Control gradual rollout with traffic stages.

- [ ] **Step 1: Write tests**

```typescript
// lib/effect-validation/__tests__/canary-controller.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { CanaryController, CANARY_STAGES } from '../canary-controller';

vi.mock('@prisma/client');

describe('CanaryController', () => {
  let controller: CanaryController;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      canaryRelease: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      canaryStageHistory: {
        create: vi.fn(),
      },
    };
    controller = new CanaryController(mockPrisma);
  });

  it('should start canary with 5% traffic', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'pending',
      currentStage: 0,
      trafficPercent: 0,
    });

    await controller.startCanary('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'running',
          currentStage: 0,
          trafficPercent: 5,
        }),
      })
    );
  });

  it('should increase traffic to next stage', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'running',
      currentStage: 0,
      trafficPercent: 5,
    });

    await controller.increaseTraffic('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStage: 1,
          trafficPercent: 10,
        }),
      })
    );
  });

  it('should complete canary at final stage', async () => {
    mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
      id: 'c-1',
      templateId: 't-1',
      status: 'running',
      currentStage: 4,
      trafficPercent: 50,
    });

    await controller.increaseTraffic('t-1');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          trafficPercent: 100,
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/effect-validation/__tests__/canary-controller.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement CanaryController**

```typescript
// lib/effect-validation/canary-controller.ts
import { CANARY_STAGES, STAGE_DURATION_HOURS } from './types';
import type { CanaryRelease, HealthStatus } from './types';
import type { PrismaClient } from '@prisma/client';

export class CanaryController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async startCanary(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'running',
        currentStage: 0,
        trafficPercent: CANARY_STAGES[0],
        startedAt: new Date(),
      },
    });

    await this.prisma.canaryStageHistory.create({
      data: {
        canaryId: templateId,
        stage: 0,
        trafficPercent: CANARY_STAGES[0],
      },
    });
  }

  async getCurrentTraffic(templateId: string): Promise<number> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });
    return canary?.trafficPercent ?? 0;
  }

  async increaseTraffic(templateId: string): Promise<void> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });

    if (!canary) {
      throw new Error(`Canary not found for template ${templateId}`);
    }

    const nextStage = canary.currentStage + 1;
    const isFinalStage = nextStage >= CANARY_STAGES.length;

    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        currentStage: isFinalStage ? canary.currentStage : nextStage,
        trafficPercent: isFinalStage ? 100 : CANARY_STAGES[nextStage],
        status: isFinalStage ? 'completed' : 'running',
      },
    });

    if (!isFinalStage) {
      await this.prisma.canaryStageHistory.updateMany({
        where: { canaryId: templateId, exitedAt: null },
        data: { exitedAt: new Date() },
      });

      await this.prisma.canaryStageHistory.create({
        data: {
          canaryId: templateId,
          stage: nextStage,
          trafficPercent: CANARY_STAGES[nextStage],
        },
      });
    }
  }

  async checkHealth(templateId: string): Promise<{ status: HealthStatus; message?: string }> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
      include: { history: { orderBy: { enteredAt: 'desc' }, take: 1 } },
    });

    if (!canary || canary.status !== 'running') {
      return { status: 'healthy' };
    }

    // Check stage duration
    const lastStage = canary.history[0];
    if (lastStage) {
      const hoursSinceEnter = (Date.now() - lastStage.enteredAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceEnter < STAGE_DURATION_HOURS) {
        return {
          status: 'healthy',
          message: `Stage ${canary.currentStage + 1} - ${Math.round(STAGE_DURATION_HOURS - hoursSinceEnter)}h remaining`,
        };
      }
    }

    return { status: 'healthy' };
  }

  async rollback(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'rolled_back',
        trafficPercent: 0,
      },
    });
  }

  async pause(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'paused' },
    });
  }

  async resume(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'running' },
    });
  }

  async getCanaryStatus(templateId: string): Promise<CanaryRelease | null> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
      include: { history: { orderBy: { enteredAt: 'desc' } } },
    });

    if (!canary) return null;

    return {
      id: canary.id,
      templateId: canary.templateId,
      currentStage: canary.currentStage,
      trafficPercent: canary.trafficPercent,
      status: canary.status as any,
      startedAt: canary.startedAt ?? undefined,
      lastHealthCheck: canary.lastHealthCheck ?? undefined,
      healthStatus: canary.healthStatus as HealthStatus | undefined,
    };
  }

  async getActiveCanaries(): Promise<CanaryRelease[]> {
    const canaries = await this.prisma.canaryRelease.findMany({
      where: { status: { in: ['running', 'paused'] } },
    });

    return canaries.map(c => ({
      id: c.id,
      templateId: c.templateId,
      currentStage: c.currentStage,
      trafficPercent: c.trafficPercent,
      status: c.status as any,
    }));
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/effect-validation/__tests__/canary-controller.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/effect-validation/canary-controller.ts
git commit -m "feat: add CanaryController for gradual rollout"
```

---

## Task 6: LEAnalyzer

**Files:**
- Create: `lib/effect-validation/le-analyzer.ts`
- Create: `lib/effect-validation/__tests__/le-analyzer.test.ts`

**Purpose:** Calculate learning effectiveness and detect anomalies.

- [ ] **Step 1: Write tests**

```typescript
// lib/effect-validation/__tests__/le-analyzer.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { LEAnalyzer } from '../le-analyzer';

vi.mock('@prisma/client');

describe('LEAnalyzer', () => {
  let analyzer: LEAnalyzer;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      rLTrainingLog: {
        groupBy: vi.fn(),
      },
      shadowAttempt: {
        groupBy: vi.fn(),
      },
    };
    analyzer = new LEAnalyzer(mockPrisma);
  });

  it('should calculate LE for knowledge point', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValueOnce([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.2 }, _count: 30 },
    ]);

    const result = await analyzer.calculateLE('kp-1');

    expect(result.knowledgePointId).toBe('kp-1');
    expect(result.le).toBe(0.2);
    expect(result.sampleSize).toBe(30);
  });

  it('should return low confidence for small sample', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValueOnce([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.2 }, _count: 10 },
    ]);

    const result = await analyzer.calculateLE('kp-1');

    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should detect LE drop anomaly', async () => {
    mockPrisma.rLTrainingLog.groupBy.mockResolvedValue([
      { knowledgePointId: 'kp-1', _avg: { leDelta: 0.3 }, _count: 50 },
      { knowledgePointId: 'kp-2', _avg: { leDelta: 0.1 }, _count: 50 },
    ]);

    const anomalies = await analyzer.detectAnomalies();

    expect(anomalies.some(a => a.type === 'le_drop')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/effect-validation/__tests__/le-analyzer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement LEAnalyzer**

```typescript
// lib/effect-validation/le-analyzer.ts
import type { LEResult, GlobalLEResult, AnomalyReport, Trend } from './types';
import type { PrismaClient } from '@prisma/client';

const LE_TARGET = 0.15;
const ANOMALY_THRESHOLD = 0.1; // 10% drop

export class LEAnalyzer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculateLE(knowledgePointId: string): Promise<LEResult> {
    const results = await this.prisma.rLTrainingLog.groupBy({
      by: ['knowledgePointId'],
      where: {
        knowledgePointId,
        postAccuracy: { not: null },
        leDelta: { not: null },
      },
      _avg: { leDelta: true },
      _count: true,
    });

    if (results.length === 0) {
      return {
        knowledgePointId,
        le: 0,
        confidence: 0,
        sampleSize: 0,
        trend: 'stable',
      };
    }

    const result = results[0];
    const le = result._avg.leDelta ?? 0;
    const sampleSize = result._count;
    const confidence = Math.min(1, sampleSize / 100);

    // Calculate trend based on recent data
    const trend = await this.calculateTrend(knowledgePointId);

    return {
      knowledgePointId,
      le,
      confidence,
      sampleSize,
      trend,
    };
  }

  async calculateGlobalLE(): Promise<GlobalLEResult> {
    const results = await this.prisma.rLTrainingLog.groupBy({
      by: ['knowledgePointId'],
      where: {
        postAccuracy: { not: null },
        leDelta: { not: null },
      },
      _avg: { leDelta: true },
      _count: true,
    });

    if (results.length === 0) {
      return {
        le: 0,
        confidence: 0,
        trend: 'stable',
        byKnowledgePoint: [],
      };
    }

    const totalLE = results.reduce((sum, r) => sum + (r._avg.leDelta ?? 0), 0);
    const le = totalLE / results.length;
    const totalSample = results.reduce((sum, r) => sum + r._count, 0);
    const confidence = Math.min(1, totalSample / 100);

    const byKnowledgePoint: LEResult[] = results.map(r => ({
      knowledgePointId: r.knowledgePointId,
      le: r._avg.leDelta ?? 0,
      confidence: Math.min(1, r._count / 100),
      sampleSize: r._count,
      trend: 'stable',
    }));

    return {
      le,
      confidence,
      trend: this.determineTrend(byKnowledgePoint),
      byKnowledgePoint,
    };
  }

  async calculateUplift(experimentId: string): Promise<{
    uplift: number;
    significant: boolean;
    pValue: number;
  }> {
    const observations = await this.prisma.effectObservation.groupBy({
      by: ['variant'],
      where: { experimentId },
      _avg: { value: true },
      _count: true,
    });

    const control = observations.find(o => o.variant === 'control');
    const treatment = observations.find(o => o.variant === 'treatment');

    if (!control || !treatment) {
      return { uplift: 0, significant: false, pValue: 1 };
    }

    const controlMean = control._avg.value ?? 0;
    const treatmentMean = treatment._avg.value ?? 0;

    const uplift = controlMean > 0
      ? ((treatmentMean - controlMean) / controlMean) * 100
      : 0;

    // Simplified significance calculation
    const pValue = this.calculatePValue(controlMean, treatmentMean, control._count, treatment._count);

    return {
      uplift,
      significant: pValue < 0.05 && treatmentMean > controlMean,
      pValue,
    };
  }

  async detectAnomalies(): Promise<AnomalyReport[]> {
    const anomalies: AnomalyReport[] = [];

    const globalLE = await this.calculateGlobalLE();

    // Check for global LE drop
    if (globalLE.le < LE_TARGET * (1 - ANOMALY_THRESHOLD)) {
      anomalies.push({
        type: 'le_drop',
        severity: 'warning',
        details: {
          metric: 'global_le',
          expected: LE_TARGET,
          actual: globalLE.le,
          deviation: (LE_TARGET - globalLE.le) / LE_TARGET,
        },
        detectedAt: new Date(),
      });
    }

    // Check individual knowledge points
    for (const kpLE of globalLE.byKnowledgePoint) {
      if (kpLE.le < LE_TARGET * 0.5) {
        anomalies.push({
          type: 'le_drop',
          severity: 'danger',
          details: {
            metric: `kp_${kpLE.knowledgePointId}_le`,
            expected: LE_TARGET,
            actual: kpLE.le,
            deviation: (LE_TARGET - kpLE.le) / LE_TARGET,
          },
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  private async calculateTrend(knowledgePointId: string): Promise<Trend> {
    // Simplified trend calculation
    // In production, would analyze time series data
    const le = await this.calculateLE(knowledgePointId);

    if (le.le >= LE_TARGET) return 'improving';
    if (le.le >= LE_TARGET * 0.7) return 'stable';
    return 'declining';
  }

  private determineTrend(kpResults: LEResult[]): Trend {
    const improving = kpResults.filter(r => r.trend === 'improving').length;
    const declining = kpResults.filter(r => r.trend === 'declining').length;

    if (improving > declining * 2) return 'improving';
    if (declining > improving * 2) return 'declining';
    return 'stable';
  }

  private calculatePValue(
    controlMean: number,
    treatmentMean: number,
    controlSample: number,
    treatmentSample: number
  ): number {
    const diff = Math.abs(treatmentMean - controlMean);
    const pooledSE = Math.sqrt((0.25 / controlSample) + (0.25 / treatmentSample));

    if (pooledSE === 0) return 1;

    const z = diff / pooledSE;
    return Math.max(0.001, Math.min(1, 2 * (1 - this.normalCDF(z))));
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/effect-validation/__tests__/le-analyzer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/effect-validation/le-analyzer.ts
git commit -m "feat: add LEAnalyzer for learning effectiveness analysis"
```

---

## Task 7: GracefulDegrader

**Files:**
- Create: `lib/effect-validation/graceful-degrader.ts`
- Create: `lib/effect-validation/__tests__/graceful-degrader.test.ts`

**Purpose:** Handle graceful degradation when metrics degrade.

- [ ] **Step 1: Write tests**

```typescript
// lib/effect-validation/__tests__/graceful-degrader.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { GracefulDegrader, DEGRADATION_RULES } from '../graceful-degrader';

vi.mock('@prisma/client');

describe('GracefulDegrader', () => {
  let degrader: GracefulDegrader;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      template: {
        update: vi.fn(),
      },
      canaryRelease: {
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };
    degrader = new GracefulDegrader(mockPrisma);
  });

  it('should degrade with warning severity', async () => {
    await degrader.degrade('t-1', 'LE dropped 10%', 'warning');

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'degrade',
          severity: 'warning',
        }),
      })
    );
  });

  it('should switch to rule engine on danger severity', async () => {
    await degrader.switchToRuleEngine('t-1');

    expect(mockPrisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't-1' },
        data: expect.objectContaining({
          // Rule engine flag
        }),
      })
    );
  });

  it('should rollback on critical severity', async () => {
    await degrader.degrade('t-1', 'LE dropped 30%', 'critical');

    expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: 't-1' },
        data: expect.objectContaining({
          status: 'rolled_back',
          trafficPercent: 0,
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/effect-validation/__tests__/graceful-degrader.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement GracefulDegrader**

```typescript
// lib/effect-validation/graceful-degrader.ts
import type { Severity, DegradationStatus, DegradationRule, Strategy } from './types';
import type { PrismaClient } from '@prisma/client';

export const DEGRADATION_RULES: Record<string, DegradationRule> = {
  le_drop_10_percent: {
    severity: 'warning',
    action: 'increase_exploration',
    description: 'LE 下降 10%，增加探索比例',
  },
  le_drop_20_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: 'LE 下降 20%，降级到规则引擎',
  },
  le_drop_30_percent: {
    severity: 'critical',
    action: 'immediate_rollback',
    description: 'LE 下降 30%，立即回滚',
  },
  accuracy_drop_15_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: '正确率下降 15%，降级到规则引擎',
  },
};

export class GracefulDegrader {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async degrade(templateId: string, reason: string, severity: Severity): Promise<void> {
    // Log the degradation
    await this.prisma.auditLog.create({
      data: {
        action: 'degrade',
        entity: 'template',
        entityId: templateId,
        changes: { reason, severity },
      },
    });

    // Update canary status
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        healthStatus: severity,
        lastHealthCheck: new Date(),
      },
    });

    // Execute degradation action based on severity
    switch (severity) {
      case 'warning':
        // Just log and continue with increased monitoring
        break;
      case 'danger':
        await this.switchToRuleEngine(templateId);
        break;
      case 'critical':
        await this.immediateRollback(templateId);
        break;
    }
  }

  async switchToRuleEngine(templateId: string): Promise<void> {
    // Log the switch
    await this.prisma.auditLog.create({
      data: {
        action: 'switch_to_rule_engine',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Update template to use rule engine
    // This would update a feature flag or similar configuration
    await this.prisma.template.update({
      where: { id: templateId },
      data: {
        // Assuming there's a field to track active strategy
        // This is implementation-specific
      },
    });

    // Pause canary
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'paused' },
    });
  }

  async immediateRollback(templateId: string): Promise<void> {
    // Log the rollback
    await this.prisma.auditLog.create({
      data: {
        action: 'immediate_rollback',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Rollback canary
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'rolled_back',
        trafficPercent: 0,
      },
    });
  }

  async recover(templateId: string): Promise<void> {
    // Log recovery
    await this.prisma.auditLog.create({
      data: {
        action: 'recover',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Resume canary from paused state
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'running',
        healthStatus: 'healthy',
      },
    });
  }

  async getDegradationStatus(templateId: string): Promise<DegradationStatus> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });

    if (!canary) {
      return {
        templateId,
        status: 'healthy',
        currentStrategy: 'rl',
      };
    }

    return {
      templateId,
      status: canary.healthStatus as DegradationStatus['status'] ?? 'healthy',
      currentStrategy: canary.status === 'paused' ? 'rule_engine' : 'rl',
      degradedAt: canary.lastHealthCheck ?? undefined,
    };
  }

  getDegradationAction(severity: Severity): string {
    switch (severity) {
      case 'warning':
        return DEGRADATION_RULES.le_drop_10_percent.action;
      case 'danger':
        return DEGRADATION_RULES.le_drop_20_percent.action;
      case 'critical':
        return DEGRADATION_RULES.le_drop_30_percent.action;
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/effect-validation/__tests__/graceful-degrader.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/effect-validation/graceful-degrader.ts
git commit -m "feat: add GracefulDegrader for automatic failover"
```

---

## Task 8: API Endpoints

**Files:**
- Create: `app/api/effect-validation/dashboard/route.ts`
- Create: `app/api/effect-validation/experiments/route.ts`
- Create: `app/api/effect-validation/experiments/[id]/route.ts`
- Create: `app/api/effect-validation/canaries/route.ts`
- Create: `app/api/effect-validation/canaries/[templateId]/increase/route.ts`
- Create: `app/api/effect-validation/canaries/[templateId]/rollback/route.ts`
- Create: `app/api/effect-validation/le/route.ts`

**Purpose:** Expose effect validation functionality via REST API.

- [ ] **Step 1: Create Dashboard API**

```typescript
// app/api/effect-validation/dashboard/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';
import type { ValidationDashboard } from '@/lib/effect-validation/types';

export async function GET() {
  try {
    const canaryController = new CanaryController(prisma);
    const experimentManager = new ExperimentManager(prisma);
    const leAnalyzer = new LEAnalyzer(prisma);

    const [activeCanaries, runningExperiments, globalLE, anomalies] = await Promise.all([
      canaryController.getActiveCanaries(),
      prisma.effectExperiment.findMany({
        where: { status: 'running' },
        select: { id: true, name: true, status: true },
      }),
      leAnalyzer.calculateGlobalLE(),
      leAnalyzer.detectAnomalies(),
    ]);

    const dashboard: ValidationDashboard = {
      activeCanaries,
      activeExperiments: runningExperiments.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        progress: 0, // Would calculate based on sample counts
      })),
      globalLE,
      anomalies,
    };

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create Experiments API**

```typescript
// app/api/effect-validation/experiments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';

const CreateExperimentSchema = z.object({
  name: z.string(),
  controlTemplateId: z.string(),
  treatmentTemplateId: z.string(),
  targetMetric: z.enum(['accuracy', 'le']),
  minSampleSize: z.number().min(10).max(200).default(50),
});

export async function GET() {
  try {
    const experiments = await prisma.effectExperiment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ experiments });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateExperimentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
    }

    const manager = new ExperimentManager(prisma);
    const id = await manager.createExperiment(parsed.data);
    await manager.startExperiment(id);

    return NextResponse.json({ id, status: 'started' });
  } catch (error) {
    console.error('Create experiment error:', error);
    return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create Canary APIs**

```typescript
// app/api/effect-validation/canaries/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

export async function GET() {
  try {
    const controller = new CanaryController(prisma);
    const canaries = await controller.getActiveCanaries();

    return NextResponse.json({ canaries });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch canaries' }, { status: 500 });
  }
}
```

```typescript
// app/api/effect-validation/canaries/[templateId]/increase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const controller = new CanaryController(prisma);
    await controller.increaseTraffic(params.templateId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Increase traffic error:', error);
    return NextResponse.json({ error: 'Failed to increase traffic' }, { status: 500 });
  }
}
```

```typescript
// app/api/effect-validation/canaries/[templateId]/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const controller = new CanaryController(prisma);
    await controller.rollback(params.templateId);

    return NextResponse.json({ success: true, status: 'rolled_back' });
  } catch (error) {
    console.error('Rollback error:', error);
    return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create LE API**

```typescript
// app/api/effect-validation/le/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

export async function GET() {
  try {
    const analyzer = new LEAnalyzer(prisma);
    const globalLE = await analyzer.calculateGlobalLE();

    return NextResponse.json(globalLE);
  } catch (error) {
    console.error('LE calculation error:', error);
    return NextResponse.json({ error: 'Failed to calculate LE' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/effect-validation/
git commit -m "feat: add effect validation API endpoints"
```

---

## Task 9: Integration Test

**Files:**
- Create: `lib/effect-validation/__tests__/integration.test.ts`

**Purpose:** Verify the full pipeline works end-to-end.

- [ ] **Step 1: Write integration test**

```typescript
// lib/effect-validation/__tests__/integration.test.ts
import { describe, it, expect } from '@jest/globals';
import { QualityScorer } from '../quality-scorer';
import type { LEResult, AnomalyReport } from '../types';

describe('Effect Validation Integration', () => {
  it('should validate LE meets threshold', () => {
    const leResult: LEResult = {
      knowledgePointId: 'kp-1',
      le: 0.2,
      confidence: 0.8,
      sampleSize: 60,
      trend: 'improving',
    };

    // LE should be >= 0.15
    expect(leResult.le).toBeGreaterThanOrEqual(0.15);
    expect(leResult.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should detect LE drop anomaly', () => {
    const anomaly: AnomalyReport = {
      type: 'le_drop',
      severity: 'danger',
      details: {
        metric: 'global_le',
        expected: 0.15,
        actual: 0.1,
        deviation: 0.33,
      },
      detectedAt: new Date(),
    };

    expect(anomaly.type).toBe('le_drop');
    expect(anomaly.severity).toBe('danger');
    expect(anomaly.details.actual).toBeLessThan(anomaly.details.expected);
  });

  it('should calculate uplift correctly', () => {
    const controlMean = 0.7;
    const treatmentMean = 0.85;
    const uplift = ((treatmentMean - controlMean) / controlMean) * 100;

    expect(uplift).toBeCloseTo(21.4, 1);
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
pnpm test lib/effect-validation/__tests__/integration.test.ts
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test lib/effect-validation/
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add lib/effect-validation/__tests__/
git commit -m "test: add effect validation integration tests"
```

---

## Task 10: Documentation

**Files:**
- Create: `lib/effect-validation/README.md`

**Purpose:** Developer documentation for the effect validation system.

- [ ] **Step 1: Write README**

```markdown
# Effect Validation System

Validates whether AI-generated templates actually improve student learning outcomes.

## Architecture

```
ShadowCollector → ExperimentManager → CanaryController → LEAnalyzer → GracefulDegrader
```

## Components

### ShadowCollector
Collects data in shadow mode without affecting live recommendations.

### ExperimentManager
Manages A/B experiments with statistical significance testing.

### CanaryController
Controls gradual rollout with traffic stages: 5% → 10% → 25% → 50% → 100%

### LEAnalyzer
Calculates learning effectiveness and detects anomalies.

### GracefulDegrader
Handles automatic failover when metrics degrade.

## API Endpoints

- `GET /api/effect-validation/dashboard` - Real-time monitoring
- `POST /api/effect-validation/experiments` - Create experiment
- `POST /api/effect-validation/canaries/:id/increase` - Increase traffic
- `POST /api/effect-validation/canaries/:id/rollback` - Manual rollback
- `GET /api/effect-validation/le` - Global LE metrics

## Usage

```typescript
import { ShadowCollector } from '@/lib/effect-validation/shadow-collector';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';

const collector = new ShadowCollector(prisma);
const manager = new ExperimentManager(prisma);

// Record shadow attempt
await collector.recordShadowAttempt({
  templateId: 't-1',
  userId: 'u-1',
  knowledgePoint: 'kp-1',
  isCorrect: true,
  duration: 30,
});

// Create experiment
const expId = await manager.createExperiment({
  name: 'New Template vs Baseline',
  controlTemplateId: 'baseline',
  treatmentTemplateId: 'new-template',
  targetMetric: 'accuracy',
  minSampleSize: 50,
});
```

## Configuration

- LE target: 0.15 (15% improvement)
- Canary stages: [5, 10, 25, 50, 100]%
- Stage duration: 24 hours
- Min sample size: 50 per group
- Significance: p < 0.05
```

- [ ] **Step 2: Commit**

```bash
git add lib/effect-validation/README.md
git commit -m "docs: add effect validation documentation"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test lib/effect-validation/
```

Expected: All tests pass

- [ ] **Step 2: Type check**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete effect validation system

This implements the Effect Validation System for Phase 2:
- ShadowCollector for shadow mode data collection
- ExperimentManager for A/B testing with statistical significance
- CanaryController for gradual rollout (5 stages)
- LEAnalyzer for learning effectiveness calculation
- GracefulDegrader for automatic failover
- REST API endpoints
- Integration tests and documentation

Ready for Phase 3: Template iteration optimization."
```

---

## Summary

This plan implements the **Effect Validation System** for verifying whether AI-generated templates improve student learning outcomes.

**Upon completion:**
- ✅ Database tables for shadow attempts, experiments, and canaries
- ✅ ShadowCollector for non-intrusive data collection
- ✅ ExperimentManager with statistical significance testing
- ✅ CanaryController with 5-stage gradual rollout
- ✅ LEAnalyzer for learning effectiveness analysis
- ✅ GracefulDegrader for automatic failover
- ✅ REST API endpoints for dashboard and control
- ✅ Integration tests and documentation
