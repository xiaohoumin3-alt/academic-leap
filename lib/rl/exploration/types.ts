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