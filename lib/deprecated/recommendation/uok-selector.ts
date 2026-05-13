/**
 * UOK Selector - Zone of Proximal Development
 *
 * Identifies the optimal learning zone for each student:
 * - Not too easy (boredom)
 * - Not too hard (frustration)
 * - Just right (flow state / learning)
 *
 * ZPD Theory:
 * - Zone where student can succeed with scaffolding
 * - Optimal difficulty range: [theta - 0.2, theta + 0.2]
 * - Target success probability: 0.5-0.7 (sweet spot for learning)
 */

import type { StudentState, ZoneOfProximalDevelopment } from './types';
import { calculateIRTProbability } from './difficulty-matcher';

/**
 * ZPD configuration constants
 */
const ZPD_WIDTH = 0.2; // Width of ZPD zone on theta scale
const MIN_PROBABILITY = 0.5; // Minimum success probability for learning
const MAX_PROBABILITY = 0.7; // Maximum success probability for learning
const DEFAULT_DISCRIMINATION = 1.0;
const DEFAULT_GUESSING = 0.25;

/**
 * Calculate the Zone of Proximal Development for a student
 *
 * @param studentState - Student's current ability state
 * @param targetKnowledgePoint - Optional specific knowledge point to analyze
 * @returns Array of ZPDs ordered by learning priority
 */
export function calculateZPD(
  studentState: StudentState,
  targetKnowledgePoint?: string
): ZoneOfProximalDevelopment[] {
  const theta = studentState.ability;
  const knowledgePoints = studentState.knowledgePoints;

  // If target specified, only return ZPD for that point
  if (targetKnowledgePoint) {
    const kp = knowledgePoints[targetKnowledgePoint];
    if (!kp) {
      return [];
    }
    return [createZPDForKnowledgePoint(targetKnowledgePoint, theta, kp.mastery)];
  }

  // Calculate ZPD for all knowledge points
  const zpdList: ZoneOfProximalDevelopment[] = [];

  for (const [kpName, kpData] of Object.entries(knowledgePoints)) {
    const zpd = createZPDForKnowledgePoint(kpName, theta, kpData.mastery);
    zpdList.push(zpd);
  }

  // Sort by priority: incomplete knowledge points first, then by mastery level
  return zpdList.sort((a, b) => {
    const aMastery = knowledgePoints[a.knowledgePoint]?.mastery ?? 0;
    const bMastery = knowledgePoints[b.knowledgePoint]?.mastery ?? 0;

    // Prioritize incomplete mastery (< 0.8)
    const aIncomplete = aMastery < 0.8 ? 1 : 0;
    const bIncomplete = bMastery < 0.8 ? 1 : 0;

    if (aIncomplete !== bIncomplete) {
      return bIncomplete - aIncomplete; // Incomplete first
    }

    // Then sort by mastery (lower mastery = higher priority)
    return aMastery - bMastery;
  });
}

/**
 * Create a ZPD for a specific knowledge point
 */
function createZPDForKnowledgePoint(
  knowledgePoint: string,
  theta: number,
  mastery: number
): ZoneOfProximalDevelopment {
  // ZPD range based on student's current ability
  const minTheta = Math.max(-3, theta - ZPD_WIDTH); // IRT theta typically in [-3, 3]
  const maxTheta = Math.min(3, theta + ZPD_WIDTH);

  // Calculate expected success probability at boundaries
  const probAtMin = calculateIRTProbability(
    theta,
    minTheta,
    DEFAULT_DISCRIMINATION,
    DEFAULT_GUESSING
  );
  const probAtMax = calculateIRTProbability(
    theta,
    maxTheta,
    DEFAULT_DISCRIMINATION,
    DEFAULT_GUESSING
  );

  // Generate reason string
  const reason = generateZPDReason(theta, mastery, probAtMin, probAtMax);

  return {
    knowledgePoint,
    minDifficulty: minTheta,
    maxDifficulty: maxTheta,
    reason,
  };
}

/**
 * Generate human-readable reason for ZPD recommendation
 */
function generateZPDReason(
  theta: number,
  mastery: number,
  probAtMin: number,
  probAtMax: number
): string {
  const thetaFormatted = theta.toFixed(2);
  const masteryPercent = Math.round(mastery * 100);

  if (mastery < 0.3) {
    return `Early learning phase (ability: ${thetaFormatted}, mastery: ${masteryPercent}%). Focus on foundational practice.`;
  } else if (mastery < 0.7) {
    return `Developing understanding (ability: ${thetaFormatted}, mastery: ${masteryPercent}%). Optimal zone for skill building.`;
  } else if (mastery < 0.9) {
    return `Approaching mastery (ability: ${thetaFormatted}, mastery: ${masteryPercent}%). Ready for challenge problems.`;
  } else {
    return `Near mastery (ability: ${thetaFormatted}, mastery: ${masteryPercent}%). Focus on application and transfer.`;
  }
}

/**
 * Select the best knowledge point from ZPD options
 *
 * Selection priorities:
 * 1. Incomplete mastery (< 0.8) prioritized
 * 2. Lower mastery gets higher priority
 * 3. Wider ZPD range (more learning opportunities)
 * 4. Recent performance trend (improving = ready for advancement)
 *
 * @param zpdOptions - Available ZPD options
 * @param studentState - Student's current state
 * @returns Best ZPD option for immediate learning
 */
export function selectFromZPD(
  zpdOptions: ZoneOfProximalDevelopment[],
  studentState: StudentState
): ZoneOfProximalDevelopment {
  if (zpdOptions.length === 0) {
    throw new Error('No ZPD options available for selection');
  }

  // Score each ZPD option
  const scoredOptions = zpdOptions.map(zpd => {
    const score = calculateZPDScore(zpd, studentState);
    return { zpd, score };
  });

  // Sort by score (highest first)
  scoredOptions.sort((a, b) => b.score - a.score);

  return scoredOptions[0].zpd;
}

/**
 * Calculate priority score for a ZPD option
 *
 * Scoring factors:
 * - Mastery level (incomplete = higher score)
 * - Recent performance trend
 * - ZPD width (wider = more options)
 * - Time since last practice
 */
function calculateZPDScore(
  zpd: ZoneOfProximalDevelopment,
  studentState: StudentState
): number {
  let score = 0;

  const kpData = studentState.knowledgePoints[zpd.knowledgePoint];
  if (!kpData) {
    // New knowledge point - high priority
    return 100;
  }

  const mastery = kpData.mastery;
  const attempts = kpData.attempts;
  const recentPerformance = kpData.recentPerformance || [];

  // Factor 1: Mastery level (0-30 points)
  // Lower mastery = higher score (more to learn)
  if (mastery < 0.3) {
    score += 30; // Foundation needs building
  } else if (mastery < 0.6) {
    score += 25; // Active learning zone
  } else if (mastery < 0.8) {
    score += 20; // Approaching mastery
  } else {
    score += 5; // Near mastery - lower priority
  }

  // Factor 2: Recent performance trend (0-25 points)
  if (recentPerformance.length >= 3) {
    const recent = recentPerformance.slice(-3);
    const trend = recent[recent.length - 1] - recent[0];

    if (trend > 0.2) {
      score += 25; // Improving - ready for advance
    } else if (trend > 0) {
      score += 20; // Slight improvement
    } else if (trend > -0.2) {
      score += 10; // Stable
    } else {
      score += 5; // Declining - may need review
    }
  }

  // Factor 3: Practice frequency (0-20 points)
  // Less practice = higher priority
  if (attempts === 0) {
    score += 20;
  } else if (attempts < 5) {
    score += 15;
  } else if (attempts < 10) {
    score += 10;
  } else {
    score += 5;
  }

  // Factor 4: ZPD width (0-15 points)
  // Wider range = more question options available
  const zpdWidth = zpd.maxDifficulty - zpd.minDifficulty;
  score += Math.min(zpdWidth * 50, 15);

  // Factor 5: Recent struggles (0-10 points)
  // If recent performance shows struggle, prioritize review
  if (recentPerformance.length > 0) {
    const avgRecent = recentPerformance.reduce((a, b) => a + b, 0) / recentPerformance.length;
    if (avgRecent < 0.5 && mastery > 0.3) {
      score += 10; // Needs review
    }
  }

  return score;
}
