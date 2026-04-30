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
