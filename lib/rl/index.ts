// lib/rl/index.ts

// Bandit
export { ThompsonSamplingBandit, validateThompsonStability } from './bandit/thompson-sampling';
export type { ThompsonSamplingConfig, CSValidationConfig } from './bandit/thompson-sampling';
export { LinearCongruentialGenerator } from './bandit/seeded-rng';
export type { SeededRNG } from './bandit/seeded-rng';
export type { BanditArm, BanditState, BanditSelection, Cloneable } from './bandit/types';

// IRT
export { estimateAbilityEAP, deltaCToDifficulty, thetaToDeltaC } from './irt/estimator';
export type { IRTResponse, IRTConfig, IRTResult } from './irt/estimator';

// Reward
export { calculateLEReward, calculateHybridReward } from './reward/le-reward';
export type { StudentResponse, LETrackingContext, RewardResult } from './reward/le-reward';

// History
export { InMemoryLEHistoryService, PrismaLEHistoryService } from './history/le-history-service';
export type { LEHistoryService, LEHistoryEntry, LEHistoryData } from './history/le-history-service';

// Persistence
export { RLModelStore } from './persistence/model-store';
export type { ModelMetadata, CreateModelOptions } from './persistence/model-store';

// Validation
export { validateDFI } from './validation/dfi';
export { validateLE } from './validation/le';
export { validateCS } from './validation/cs';
export type { DFIValidationResult } from './validation/dfi';
export type { LEValidationResult } from './validation/le';
export type { CSValidationResult } from './validation/cs';

// Monitor
export { irtProbability, estimateDifficulty, detectDifficultyDrift } from './monitor';
export type { QuestionAttempt, DifficultyDrift } from './monitor';
