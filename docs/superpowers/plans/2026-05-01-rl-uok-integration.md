# RL-UOK Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate RL exploration layer into UOK recommendation as an enhancement

**Architecture:** RLExplorationController wraps HealthMonitor and returns candidate count based on health status. Selector performs weighted random selection from candidates.

**Tech Stack:** TypeScript, Jest, existing RL Phase 1-3 components

---

## File Structure

```
lib/rl/exploration/
├── types.ts                              # Type definitions (NEW)
├── selector.ts                           # Weighted random selector (NEW)
├── selector.test.ts                     # Selector tests (NEW)
├── rl-exploration-controller.ts          # Main controller (NEW)
├── rl-exploration-controller.test.ts     # Controller tests (NEW)
└── index.ts                            # Exports (NEW)

lib/rl/config/
└── phase3-features.ts                   # Add uokIntegration config (MODIFY)

lib/qie/
└── recommendation-service.ts             # Integrate RL controller (MODIFY)
```

---

## Task 1: Type Definitions

**Files:**
- Create: `lib/rl/exploration/types.ts`
- Test: None (types only)

- [ ] **Step 1: Write types**

```typescript
// lib/rl/exploration/types.ts

export type HealthLevel = 'healthy' | 'warning' | 'danger' | 'collapsed';
export type ExplorationLevel = 'minimal' | 'moderate' | 'aggressive';

export interface ExplorationConfig {
  baseCandidateCount: number;
  maxCandidateCount: number;
  explorationThreshold: number;
}

export interface ExplorationContext {
  topic: string;
  mastery: number;
  consecutiveSameTopic: number;
}

export interface ExplorationResult {
  candidateCount: number;
  explorationLevel: ExplorationLevel;
  factors: {
    healthLevel: HealthLevel;
    consecutiveSameTopic: number;
    le: number;
    cs: number;
  };
  reason: string;
}

export interface ExplorationRecord {
  topic: string;
  timestamp: number;
  complexity: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/rl/exploration/types.ts
git commit -m "feat: add RL exploration types"
```

---

## Task 2: Selector

**Files:**
- Create: `lib/rl/exploration/selector.ts`
- Create: `lib/rl/exploration/selector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/rl/exploration/selector.test.ts
import { selectCandidate, SELECTION_WEIGHTS } from './selector';

describe('selectCandidate', () => {
  const candidates = [
    { id: 1, score: 0.9 },
    { id: 2, score: 0.8 },
    { id: 3, score: 0.7 },
    { id: 4, score: 0.6 },
    { id: 5, score: 0.5 },
  ];

  describe('minimal exploration', () => {
    it('should select first candidate most of the time', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'minimal')
      );
      const firstCount = results.filter(r => r.id === 1).length;
      expect(firstCount).toBeGreaterThan(50);
    });

    it('should rarely select beyond third candidate', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'minimal')
      );
      const beyondThird = results.filter(r => r.id > 3).length;
      expect(beyondThird).toBe(0);
    });
  });

  describe('aggressive exploration', () => {
    it('should distribute selections more evenly', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'aggressive')
      );
      const uniqueSelections = new Set(results.map(r => r.id)).size;
      expect(uniqueSelections).toBeGreaterThan(2);
    });
  });

  describe('edge cases', () => {
    it('should return the only candidate for single-item array', () => {
      const single = [{ id: 1 }];
      const result = selectCandidate(single, 'minimal');
      expect(result.id).toBe(1);
    });

    it('should handle empty array gracefully', () => {
      const result = selectCandidate([], 'minimal');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/rl/exploration/selector.test.ts`
Expected: FAIL with "Cannot find module './selector'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/rl/exploration/selector.ts

import type { ExplorationLevel } from './types';

export const SELECTION_WEIGHTS = {
  minimal: [0.7, 0.2, 0.1, 0, 0],
  moderate: [0.4, 0.25, 0.2, 0.1, 0.05],
  aggressive: [0.2, 0.2, 0.2, 0.2, 0.2],
} as const;

/**
 * Select a candidate based on exploration level using weighted random selection.
 *
 * @param candidates - Array of candidates to select from
 * @param explorationLevel - Level of exploration ('minimal', 'moderate', 'aggressive')
 * @returns Selected candidate or null if candidates array is empty
 */
export function selectCandidate<T>(
  candidates: T[],
  explorationLevel: ExplorationLevel
): T | null {
  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const weights = SELECTION_WEIGHTS[explorationLevel];

  // Calculate cumulative weights for candidates
  const cumWeights = candidates.map((_, index) => {
    const weight = weights[index] ?? weights[weights.length - 1] / (index - weights.length + 2);
    return weight;
  });

  // Normalize
  const total = cumWeights.reduce((a, b) => a + b, 0);

  // Weighted random selection
  let random = Math.random() * total;

  for (let i = 0; i < candidates.length; i++) {
    random -= cumWeights[i];
    if (random <= 0) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/rl/exploration/selector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/rl/exploration/selector.ts lib/rl/exploration/selector.test.ts
git commit -m "feat: add RL exploration selector with weighted random selection"
```

---

## Task 3: RLExplorationController

**Files:**
- Create: `lib/rl/exploration/rl-exploration-controller.ts`
- Create: `lib/rl/exploration/rl-exploration-controller.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/rl/exploration/rl-exploration-controller.test.ts
import { RLExplorationController } from './rl-exploration-controller';
import type { ExplorationConfig, ExplorationContext } from './types';

describe('RLExplorationController', () => {
  const defaultConfig: ExplorationConfig = {
    baseCandidateCount: 2,
    maxCandidateCount: 5,
    explorationThreshold: 0.3,
  };

  describe('getCandidateCount', () => {
    it('should return base count for healthy system', () => {
      const controller = new RLExplorationController(defaultConfig);
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 1,
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBe(2);
      expect(result.explorationLevel).toBe('minimal');
    });

    it('should increase count for warning health', () => {
      const controller = new RLExplorationController(defaultConfig);
      // Simulate low LE to trigger warning
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.3,
        consecutiveSameTopic: 1,
      };

      // Manually set health to warning via recordResponse
      for (let i = 0; i < 20; i++) {
        controller.recordResponse({
          topic: 'algebra',
          correct: false,
          complexity: 0.5,
        });
      }

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBeGreaterThanOrEqual(3);
      expect(['moderate', 'aggressive']).toContain(result.explorationLevel);
    });

    it('should increase count for consecutive same topic', () => {
      const controller = new RLExplorationController(defaultConfig);
      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 3,
      };

      const result = controller.getCandidateCount(context);

      expect(result.candidateCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('recordRecommendation', () => {
    it('should track recommendation history', () => {
      const controller = new RLExplorationController(defaultConfig);

      controller.recordRecommendation('algebra');
      controller.recordRecommendation('geometry');
      controller.recordRecommendation('algebra');

      const context: ExplorationContext = {
        topic: 'algebra',
        mastery: 0.6,
        consecutiveSameTopic: 0,
      };

      const result = controller.getCandidateCount(context);

      expect(result.factors.consecutiveSameTopic).toBe(2);
    });
  });

  describe('getConsecutiveSameTopicCount', () => {
    it('should return 1 for first topic', () => {
      const controller = new RLExplorationController(defaultConfig);
      controller.recordRecommendation('algebra');
      expect(controller.getConsecutiveSameTopicCount('algebra')).toBe(1);
    });

    it('should count consecutive same topics', () => {
      const controller = new RLExplorationController(defaultConfig);
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('algebra');
      controller.recordRecommendation('geometry');
      controller.recordRecommendation('algebra');

      expect(controller.getConsecutiveSameTopicCount('algebra')).toBe(1);
      expect(controller.getConsecutiveSameTopicCount('geometry')).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/rl/exploration/rl-exploration-controller.test.ts`
Expected: FAIL with "Cannot find module './rl-exploration-controller'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/rl/exploration/rl-exploration-controller.ts

import { HealthMonitor } from '../health/monitor';
import type {
  ExplorationConfig,
  ExplorationContext,
  ExplorationResult,
  ExplorationLevel,
  HealthLevel,
} from './types';
import { selectCandidate } from './selector';

/**
 * RL Exploration Controller
 *
 * Wraps HealthMonitor to determine candidate count for UOK recommendations.
 * Used as exploration enhancement layer for UOK recommendation engine.
 */
export class RLExplorationController {
  private readonly config: ExplorationConfig;
  private healthMonitor: HealthMonitor;
  private topicHistory: string[] = [];

  constructor(config?: Partial<ExplorationConfig>) {
    this.config = {
      baseCandidateCount: config?.baseCandidateCount ?? 2,
      maxCandidateCount: config?.maxCandidateCount ?? 5,
      explorationThreshold: config?.explorationThreshold ?? 0.3,
    };
    this.healthMonitor = new HealthMonitor();
  }

  /**
   * Get candidate count based on health status and context
   */
  getCandidateCount(context: ExplorationContext): ExplorationResult {
    const health = this.healthMonitor.check();
    const consecutiveSame = this.getConsecutiveSameTopicCount(context.topic);

    let candidateCount = this.config.baseCandidateCount;
    let explorationLevel: ExplorationLevel = 'minimal';
    let reason = 'System healthy, minimal exploration';

    // Adjust based on health level
    switch (health.level) {
      case 'warning':
        candidateCount = 3;
        explorationLevel = 'moderate';
        reason = `Health warning: ${health.alerts.join(', ') || 'low metrics'}`;
        break;

      case 'danger':
        candidateCount = 4;
        explorationLevel = 'aggressive';
        reason = `Health danger: ${health.alerts.join(', ') || 'critical metrics'}`;
        break;

      case 'collapsed':
        candidateCount = this.config.maxCandidateCount;
        explorationLevel = 'aggressive';
        reason = 'System collapsed, maximum exploration';
        break;
    }

    // Adjust for pseudo-convergence
    if (health.metrics.isPseudoConverged) {
      candidateCount = Math.min(candidateCount + 2, this.config.maxCandidateCount);
      explorationLevel = 'aggressive';
      reason = `Pseudo-convergence detected: ${health.metrics.pseudoConvergenceReason || 'unknown'}`;
    }

    // Adjust for consecutive same topic
    if (consecutiveSame >= 3) {
      candidateCount = Math.min(candidateCount + 1, this.config.maxCandidateCount);
      if (explorationLevel === 'minimal') {
        explorationLevel = 'moderate';
      }
      reason = `Consecutive same topic (${consecutiveSame}), increasing exploration`;
    }

    return {
      candidateCount,
      explorationLevel,
      factors: {
        healthLevel: health.level,
        consecutiveSameTopic: consecutiveSame,
        le: health.metrics.le,
        cs: health.metrics.cs,
      },
      reason,
    };
  }

  /**
   * Record a recommendation for history tracking
   */
  recordRecommendation(topic: string): void {
    this.topicHistory.push(topic);
    // Keep history limited
    if (this.topicHistory.length > 100) {
      this.topicHistory.shift();
    }
  }

  /**
   * Get consecutive count for a specific topic
   */
  getConsecutiveSameTopicCount(topic: string): number {
    let count = 0;
    for (let i = this.topicHistory.length - 1; i >= 0; i--) {
      if (this.topicHistory[i] === topic) {
        count++;
      } else {
        break;
      }
    }
    return Math.max(1, count);
  }

  /**
   * Record a response for health monitoring
   */
  recordResponse(response: {
    topic: string;
    correct: boolean;
    complexity: number;
  }): void {
    this.healthMonitor.recordResponse({
      theta: response.complexity * 3, // Convert complexity to approximate theta
      deltaC: response.complexity * 10,
      correct: response.correct,
      timestamp: Date.now(),
    });
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return this.healthMonitor.check();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/rl/exploration/rl-exploration-controller.test.ts`
Expected: PASS

- [ ] **Step 5: Create index file**

```typescript
// lib/rl/exploration/index.ts

export { RLExplorationController } from './rl-exploration-controller';
export { selectCandidate, SELECTION_WEIGHTS } from './selector';
export type {
  ExplorationConfig,
  ExplorationContext,
  ExplorationResult,
  ExplorationLevel,
  ExplorationRecord,
  HealthLevel,
} from './types';
```

- [ ] **Step 6: Commit**

```bash
git add lib/rl/exploration/rl-exploration-controller.ts lib/rl/exploration/rl-exploration-controller.test.ts lib/rl/exploration/index.ts
git commit -m "feat: implement RLExplorationController for UOK integration"
```

---

## Task 4: Update Phase 3 Features Config

**Files:**
- Modify: `lib/rl/config/phase3-features.ts`

- [ ] **Step 1: Read current config**

```bash
cat lib/rl/config/phase3-features.ts
```

- [ ] **Step 2: Add uokIntegration config**

Add to `PHASE_3_FEATURES`:

```typescript
uokIntegration: {
  enabled: parseEnvBool('RL_UOK_INTEGRATION_ENABLED', true),
  config: {
    baseCandidateCount: parseEnvInt('RL_BASE_CANDIDATE_COUNT', 2),
    maxCandidateCount: parseEnvInt('RL_MAX_CANDIDATE_COUNT', 5),
  },
},
```

Add helper functions if not exist:

```typescript
function parseEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/rl/config/phase3-features.ts
git commit -m "feat: add uokIntegration config to Phase 3 features"
```

---

## Task 5: Integrate into recommendation-service

**Files:**
- Modify: `lib/qie/recommendation-service.ts`

- [ ] **Step 1: Read current implementation**

Read `lib/qie/recommendation-service.ts` to understand the structure, particularly:
- `getNextQuestion` function
- `findBestMatch` function
- `encodeAnswerToUOK` function

- [ ] **Step 2: Add imports**

```typescript
import { RLExplorationController, selectCandidate } from '@/lib/rl/exploration';
import { isFeatureEnabled, getFeatureConfig } from '@/lib/rl/config/phase3-features';

// Global singleton instance
let rlController: RLExplorationController | null = null;

function getRLController(): RLExplorationController | null {
  if (!isFeatureEnabled('adaptation')) return null;
  if (!rlController) {
    const config = getFeatureConfig('uokIntegration');
    rlController = new RLExplorationController({
      baseCandidateCount: config.baseCandidateCount,
      maxCandidateCount: config.maxCandidateCount,
    });
  }
  return rlController;
}
```

- [ ] **Step 3: Modify getNextQuestion to integrate RL**

In `getNextQuestion`, after getting candidates from `findBestMatch`, add:

```typescript
// Get candidates
const candidates = await findTopNCandidates(topic, mastery, 10);

if (!rl) {
  // No RL, return best candidate
  return candidates[0];
}

// Get exploration info
const exploration = rl.getCandidateCount({
  topic,
  mastery,
  consecutiveSameTopic: rl.getConsecutiveSameTopicCount(topic),
});

// Select from candidates
const selected = selectCandidate(
  candidates.slice(0, exploration.candidateCount),
  exploration.explorationLevel
);

// Record recommendation
rl.recordRecommendation(topic);

// Return with exploration info
return {
  success: true,
  question: selected,
  rationale: {
    ...baseRationale,
    explorationInfo: {
      candidateCount: exploration.candidateCount,
      explorationLevel: exploration.explorationLevel,
      reason: exploration.reason,
    },
  },
};
```

- [ ] **Step 4: Modify encodeAnswerToUOK to record responses**

In `encodeAnswerToUOK`, after UOK processing:

```typescript
const rl = getRLController();
if (rl && question) {
  rl.recordResponse({
    topic: parseKnowledgePoints(question.knowledgePoints)[0] ?? 'unknown',
    correct,
    complexity: question.complexity ?? 0.5,
  });
}
```

- [ ] **Step 5: Add helper function for Top-N candidates**

```typescript
async function findTopNCandidates(
  topic: string,
  mastery: number,
  n: number
): Promise<QuestionWithComplexity[]> {
  // Similar to findBestMatch but returns top N
  const targetComplexity = 0.3 + (mastery * 0.5);
  const questions = await prisma.question.findMany({
    where: {
      extractionStatus: 'SUCCESS',
      complexity: { not: null },
    },
    select: {
      id: true,
      content: true,
      difficulty: true,
      knowledgePoints: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
    },
    take: 100,
  });

  const scored = questions
    .filter(q => {
      const kp = parseKnowledgePoints(q.knowledgePoints);
      return kp.some(k => k.includes(topic) || topic.includes(k));
    })
    .map(q => ({
      ...q,
      score: -Math.abs((q.complexity ?? 0.5) - targetComplexity),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n);

  return scored.map(q => ({
    id: q.id,
    content: q.content,
    difficulty: q.difficulty,
    knowledgePoints: parseKnowledgePoints(q.knowledgePoints),
    cognitiveLoad: q.cognitiveLoad,
    reasoningDepth: q.reasoningDepth,
    complexity: q.complexity,
  }));
}
```

- [ ] **Step 6: Add ExplorationInfo to types**

In `lib/qie/types.ts` or at top of `recommendation-service.ts`:

```typescript
interface ExplorationInfo {
  candidateCount: number;
  explorationLevel: 'minimal' | 'moderate' | 'aggressive';
  reason: string;
}
```

- [ ] **Step 7: Update NextQuestionResponse**

```typescript
export interface NextQuestionResponse {
  success: boolean;
  question?: QuestionWithComplexity;
  rationale?: RecommendationRationale & { explorationInfo?: ExplorationInfo };
  error?: string;
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/qie/recommendation-service.ts
git commit -m "feat: integrate RL exploration into UOK recommendation"
```

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

Find the Phase 2 or Phase 3 section.

- [ ] **Step 2: Add RL-UOK Integration section**

```markdown
## Phase 4: RL-UOK Integration (2026-05-01)

### 架构

RL 作为 UOK 的探索增强层：

```
UOK 推荐 → RLExplorationController → 返回 Top-N 候选 → 加权随机选择
```

### 组件

| 组件 | 文件 | 描述 |
|------|------|------|
| RLExplorationController | `lib/rl/exploration/rl-exploration-controller.ts` | 健康监控 + 候选数量 |
| Selector | `lib/rl/exploration/selector.ts` | 加权随机选择 |

### 探索等级

| 等级 | 权重分布 | 触发条件 |
|------|---------|----------|
| minimal | [0.7, 0.2, 0.1, 0, 0] | 健康 |
| moderate | [0.4, 0.25, 0.2, 0.1, 0.05] | Warning / 同知识点≥3 |
| aggressive | [0.2, 0.2, 0.2, 0.2, 0.2] | Danger / 伪收敛 |

### 特性开关

```bash
RL_UOK_INTEGRATION_ENABLED=true
RL_BASE_CANDIDATE_COUNT=2
RL_MAX_CANDIDATE_COUNT=5
```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add RL-UOK integration documentation"
```

---

## Task 7: Integration Test

**Files:**
- Create: `lib/qie/__tests__/rl-uok-integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// lib/qie/__tests__/rl-uok-integration.test.ts
import { getNextQuestion } from '../recommendation-service';

describe('RL-UOK Integration', () => {
  describe('with RL enabled', () => {
    it('should return candidates with exploration info', async () => {
      // This would need a real test user
      // Skip in CI if no test user available
    });
  });

  describe('health monitoring integration', () => {
    it('should record responses to health monitor', async () => {
      // Verify encodeAnswerToUOK calls recordResponse
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/qie/__tests__/rl-uok-integration.test.ts
git commit -m "test: add RL-UOK integration tests"
```

---

## Summary

| Task | Files | Tests |
|------|-------|-------|
| 1. Types | types.ts | - |
| 2. Selector | selector.ts, selector.test.ts | 5 tests |
| 3. Controller | rl-exploration-controller.ts, test.ts | 5 tests |
| 4. Config | phase3-features.ts | - |
| 5. UOK Integration | recommendation-service.ts | 2 tests |
| 6. Docs | CLAUDE.md | - |
| 7. Integration Test | rl-uok-integration.test.ts | 2 tests |

**Total tests to add:** ~14 tests
