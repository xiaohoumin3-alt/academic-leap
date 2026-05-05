/**
 * Recommendation Types
 */

export interface Question {
  id: string;
  knowledgePoint: string;
  difficultyLevel: number;
  content: {
    question: string;
    answer: string;
    explanation?: string;
  };
}

export interface StudentState {
  studentId: string;
  ability: number; // IRT theta estimate
  knowledgePoints: Record<string, {
    mastery: number; // 0-1
    attempts: number;
    recentPerformance: number[];
  }>;
}

export interface ZoneOfProximalDevelopment {
  knowledgePoint: string;
  minDifficulty: number;
  maxDifficulty: number;
  reason: string;
}
