# RL Adaptive Engine Design Review

**Date**: 2026-04-29
**Reviewer**: Design Review Agent
**Document**: `/docs/superpowers/specs/2026-04-29-rl-adaptive-engine-design.md`
**Status**: **NEEDS_REVISION** ❌

---

## Executive Summary

The RL Adaptive Engine design proposes a LinUCB bandit-based adaptive learning system. While conceptually sound, **the design has critical gaps** that conflict with project acceptance standards (DFI, LE, CS) and requires significant revision before implementation.

**Verdict**: The design is **not ready** for implementation. Requires architectural revision.

---

## 三原则审视

### 1. 2/8原则
**核心20%**: LinUCB bandit algorithm + composite reward function
**分析**: 设计包含了大量非核心组件（完整训练管线、复杂状态追踪、多阶段训练），但**未证明核心算法在当前数据环境下有效**。
**问题**: 复杂度过高，80%的功能（simulation、drift detection、A/B framework）分散了对核心验证的关注。

### 2. 第一性原理
**根本问题**: 现有规则式引擎无法个性化
**设计方向**: 引入RL实现个性化
**质疑**: LinUCB是否是最适合的选择？
- **特征空间**: 30维交互特征可能导致数据稀疏
- **冷启动**: 需要10题才能开始有效推荐
- **训练数据**: 当前系统是否有足够的historical data？

### 3. 收益递减
**当前方案**: 完整RL训练管线 + 监控系统 + A/B测试
**边界判断**: **已进入过度设计阶段**
- Simulation环境假设过于理想化
- A/B测试框架属于部署后考虑
- 复杂的reward function可能难以调优

---

## Acceptance Standards Alignment

### ① DFI (Data Flow Integrity) ≥ 0.99

| Aspect | Status | Notes |
|--------|--------|-------|
| Event Tracing | ⚠️ PARTIAL | Adds RL context fields to AttemptStep |
| Unique IDs | ✅ PASS | Uses existing eventId pattern |
| Full Traceability | ❌ FAIL | Missing: RL decision → reward → update linkage |

**Critical Gap**: The design shows `rlStateBefore`, `rlStateAfter`, `rlReward`, `rlUCBScore` fields, but **doesn't specify the exact flow**:
```
Question Selection → (record UCB score) → Student Response → 
(calculate reward) → Model Update → (verify reward logged)
```

**Recommendation**: Add explicit DFI trace specification:
```typescript
// Each learning event must record:
interface RLEventTrace {
  eventId: string;           // Links to Attempt.id
  stateBefore: StateVector;   // Before question
  selectedQuestion: string;   // Question ID
  ucbScore: number;           // Decision score
  studentResponse: boolean;   // Correct/incorrect
  reward: number;             // Calculated reward
  stateAfter: StateVector;    // After update
  modelVersion: string;       // Which model was used
}
```

### ② LE (Learning Effectiveness) > 0.15

| Aspect | Status | Notes |
|--------|--------|-------|
| Success Criteria | ✅ PASS | +20% learning rate, AUC > 0.7 |
| Measurement Method | ⚠️ UNCLEAR | How to measure "learning gain per session"? |
| Baseline Comparison | ❌ FAIL | No comparison to current UOK system |

**Critical Issues**:

1. **Composite Reward Function Not Validated**
   ```typescript
   const raw = 0.4 * accuracyReward + 
               0.3 * Math.tanh(learningGain * 5) + 
               0.2 * efficiencyReward + 
               0.1 * engagementReward;
   ```
   - Weights (0.4, 0.3, 0.2, 0.1) appear arbitrary
   - No empirical justification for these values
   - `Math.tanh(learningGain * 5)` magic number

2. **Learning Gain Calculation Undefined**
   ```typescript
   const learningGain = stateAfter.ability - stateBefore.ability;
   ```
   - How is `ability` (IRT theta) estimated from responses?
   - Design mentions "IRT estimated" but gives no algorithm
   - This is a **critical missing piece**

3. **No LE Validation Plan**
   - Design doesn't specify how to measure LE during A/B test
   - "Mastery gain per session" needs operational definition

**Recommendation**:
1. **Remove composite reward** - Start with single-metric reward (accuracy)
2. **Specify IRT estimation** - Add complete algorithm for ability estimation
3. **Define LE measurement** - Add explicit formula for mastery gain calculation

### ③ CS (Convergence Stability) ≥ 0.85

| Aspect | Status | Notes |
|--------|--------|-------|
| Stability Concerns | ❌ FAIL | Multiple instability sources |
| Exploration Control | ⚠️ PARTIAL | Capped at 20%, but LinUCB has no explicit cap |
| State Drift | ❌ FAIL | No mechanism to detect/prevent drift |

**Critical Issues**:

1. **LinUCB Inherent Instability**
   - UCB scores are *relative* to other arms in the same arm group
   - Adding/removing questions changes all UCB scores
   - This violates CS requirement

2. **No Stability Metrics**
   - Design mentions "drift detection" but only for reward trend
   - No measurement of recommendation stability across runs
   - Missing: CS-specific evaluation

3. **Cold Start Problem**
   ```
   "Use rule-based for first 10 questions"
   ```
   - Creates inconsistency for new users
   - First 10 recommendations = rule-based
   - After 10 = RL-based
   - This transition is a stability risk

**Recommendation**:
1. **Add CS evaluation** - Include CS test in Phase 0 (implementation)
2. **Stability guarantee** - Add constraint: "UCB scores must not change >10% between runs"
3. **Smoother transition** - Use blended recommendation during cold start

---

## Design Quality Assessment

### Architecture Review

| Component | Quality | Issues |
|-----------|---------|--------|
| State Space | C | 6 dimensions with undefined calculation methods |
| Feature Extraction | D | structure encoding missing; distraction undefined |
| LinUCB Implementation | B | Standard, but cluster arm strategy loses precision |
| Reward Function | D | Unvalidated composite; magic numbers |
| Training Pipeline | C | Simulation assumptions unrealistic |

**Critical Missing Implementations**:

1. **State Feature Calculations** (mentioned in Appendix, but incomplete)
   ```typescript
   // Design shows signature, but:
   function learning_velocity(accuracies: number[]): number {
     // Where do "last 10 accuracies" come from?
     // Are they from current session? All-time?
     // What if student has <10 responses?
   }
   ```

2. **Question Feature Extraction**
   ```typescript
   function encodeStructure(s: string): number {
     const map = { linear: 0, nested: 1, multi_equation: 2, constraint_chain: 3 };
     return map[s] ?? 0;
   }
   // CRITICAL: Where does Question.structure come from?
   // Current schema has NO structure field!
   ```

3. **IRT Ability Estimation**
   - Design says "θ ∈ [0, 1], IRT estimated"
   - But gives NO algorithm
   - This is a **showstopper** - ability is central to state vector

### Database Schema Review

```prisma
model RLModelVersion {
  // ...
  weights     String   @default("{}")  // JSON: A_inv, b, theta per arm
}
```

**Issues**:
1. **Weights as JSON string** - inefficient for large matrices
2. **No model diff tracking** - can't rollback easily
3. **Missing deployment flags** - no way to mark "canary" vs "full"

### API Design Review

**Strengths**:
- Clean separation of public vs admin APIs
- Good response structure with observability

**Issues**:
1. **No rate limiting** mentioned
2. **No cache strategy** for model loading
3. **Missing error responses** for edge cases

---

## Comparison with Existing System

### Current System: UOK + Complexity-Based

| Feature | Current | Proposed |
|---------|---------|----------|
| Algorithm | Rule-based + ML embedding | LinUCB bandit |
| State | Knowledge map + embeddings | 6-dim state vector |
| Personalization | Per-student embeddings | Per-student arm parameters |
| Training | Online (per response) | 3-phase (offline + sim + online) |
| Complexity | ~500 lines (uok.ts) | ~2000 lines (estimated) |

### Migration Risk

**Current System** (CS ≥ 0.85 target):
- UOK uses deterministic state machine
- Recommendations are explainable
- Global transfer weights enable cross-student learning

**Proposed System** (CS unknown):
- LinUCB is stochastic (exploration)
- Recommendations are black-box (UCB scores)
- Each student has independent arm parameters

**Risk**: Replacing a stable system with an unstable one without proving LE > 0.15 first.

---

## Critical Issues Summary

### Showstoppers (Must Fix)

1. **Missing IRT Algorithm**: Ability estimation is undefined
2. **Undefined Features**: Question.structure, distraction don't exist
3. **Unvalidated Reward**: Composite function has no empirical basis
4. **CS Violation**: LinUCB inherently unstable
5. **Cold Start Gap**: 10-question cutoff creates discontinuity

### High Priority

6. **No LE Validation**: Design doesn't prove learning effectiveness
7. **Simulation Assumptions**: Unrealistic student model
8. **Data Requirements**: Unclear if 10k historical samples exist
9. **Cluster Arm Precision**: Bucketing loses personalization
10. **No Rollback Plan**: If RL fails, can we revert?

### Medium Priority

11. **Monitoring Gaps**: No CS-specific metrics
12. **Deployment Complexity**: 7-phase plan is over-engineered
13. **Missing Tests**: No unit test strategy
14. **Performance**: p95 < 100ms may be unrealistic

---

## Recommendations

### Immediate Actions (Before Implementation)

1. **STOP** - Do not implement this design as-is

2. **Create MVP Proof-of-Concept**:
   - Implement ONLY LinUCB with accuracy reward
   - Skip composite reward, skip simulation phase
   - Run on 100 students, measure LE and CS
   - If LE > 0.15 AND CS ≥ 0.85, proceed

3. **Add Missing Components**:
   ```typescript
   // MUST add to design:
   - IRT ability estimation algorithm
   - Question structure extraction
   - State feature calculation (with <10 response handling)
   - LE measurement formula
   - CS evaluation method
   ```

4. **Simplify Architecture**:
   - Remove: Simulation phase, drift detection, A/B framework
   - Keep: LinUCB, accuracy reward, online training
   - Add: Rollback mechanism, CS monitoring

### Alternative Approach

Consider **hybrid system** instead of full replacement:
```
Phase 1: UOK continues (baseline)
Phase 2: RL runs in shadow mode (predictions only)
Phase 3: Compare LE/CS metrics
Phase 4: Gradual rollout if metrics pass
```

---

## Conclusion

The RL Adaptive Engine design is **conceptually sound but executionally incomplete**. It fails to adequately address:

1. **Data Flow Integrity**: Missing explicit trace specification
2. **Learning Effectiveness**: Unvalidated reward function, no LE proof
3. **Convergence Stability**: LinUCB inherently unstable, no CS guarantees

**Recommendation**: **REVISE AND RESUBMIT**

**Required Changes**:
1. Add complete IRT ability estimation
2. Define all feature extraction methods
3. Simplify to single-metric reward (accuracy)
4. Add CS evaluation and guarantees
5. Create MVP validation plan
6. Add rollback mechanism

**Estimated Revision Effort**: 2-3 days of design work + 1 week MVP validation

---

**Review Status**: ❌ NEEDS_REVISION
**Next Review**: After addressing showstoppers #1-5
**Review Date**: 2026-04-29
