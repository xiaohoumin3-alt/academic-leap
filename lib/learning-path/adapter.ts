/**
 * Learning Path Micro-Adjustment Adapter
 *
 * Adjusts learning path priorities based on practice results.
 */

import { prisma } from '@/lib/prisma';
import type { PathKnowledgeNode } from './types';

// Constants for priority adjustments
export const PRIORITY_DECREASE_CORRECT = 0.2; // -20% for correct answers
export const PRIORITY_INCREASE_WRONG = 0.3;   // +30% for wrong answers
export const RELATED_ADJUSTMENT = 0.05;       // ±5% for related nodes

export interface PracticeResult {
  knowledgePointId: string;
  isCorrect: boolean;
}

export interface MicroAdjustment {
  nodeId: string;
  oldPriority: number;
  newPriority: number;
  reason: string;
}

export interface MicroAdjustmentResult {
  adjustments: MicroAdjustment[];
  nextRecommendation?: {
    nodeId: string;
    priority: number;
  };
}

/**
 * Calculate micro-adjustments based on practice results
 *
 * Rules:
 * - Correct answer → priority decreases 20%
 * - Wrong answer → priority increases 30%
 * - Related nodes in same chapter → adjust ±5%
 */
export function calculateMicroAdjustments(
  nodes: PathKnowledgeNode[],
  practiceResults: PracticeResult[]
): MicroAdjustmentResult {
  const adjustments: MicroAdjustment[] = [];
  const adjustedNodes = new Map<string, number>();
  const nodeMap = new Map(nodes.map(n => [n.nodeId, n]));

  // Track overall performance for related node adjustments
  let hasCorrect = false;
  let hasWrong = false;

  // Process each practice result
  for (const result of practiceResults) {
    const node = nodeMap.get(result.knowledgePointId);
    if (!node) continue;

    const oldPriority = node.priority;
    let newPriority: number;
    let reason: string;

    if (result.isCorrect) {
      newPriority = oldPriority * (1 - PRIORITY_DECREASE_CORRECT);
      reason = '回答正确，优先级下降';
      hasCorrect = true;
    } else {
      newPriority = oldPriority * (1 + PRIORITY_INCREASE_WRONG);
      reason = '回答错误，优先级上升';
      hasWrong = true;
    }

    // Clamp priority to non-negative
    newPriority = Math.max(0, newPriority);

    adjustedNodes.set(node.nodeId, newPriority);
    adjustments.push({
      nodeId: node.nodeId,
      oldPriority,
      newPriority,
      reason
    });
  }

  // Adjust related nodes (simplified: all other nodes)
  // In a full implementation, this would check chapter relationships
  for (const node of nodes) {
    if (adjustedNodes.has(node.nodeId)) continue;

    const oldPriority = node.priority;
    let newPriority: number;
    let reason: string;

    // Direction based on overall practice results
    if (hasCorrect && !hasWrong) {
      newPriority = oldPriority * (1 - RELATED_ADJUSTMENT);
      reason = '相关知识点进步';
    } else if (hasWrong && !hasCorrect) {
      newPriority = oldPriority * (1 + RELATED_ADJUSTMENT);
      reason = '相关知识点需关注';
    } else {
      continue; // No adjustment if mixed or no results
    }

    newPriority = Math.max(0, newPriority);
    adjustedNodes.set(node.nodeId, newPriority);
    adjustments.push({
      nodeId: node.nodeId,
      oldPriority,
      newPriority,
      reason
    });
  }

  // Find next recommendation (highest priority node that wasn't just mastered)
  let nextRecommendation: MicroAdjustmentResult['nextRecommendation'];

  // Filter out completed nodes and find highest priority
  const remainingNodes = nodes.filter(n => {
    const newPriority = adjustedNodes.get(n.nodeId);
    return newPriority !== undefined && newPriority > 0;
  });

  if (remainingNodes.length > 0) {
    // Sort by new priority descending
    remainingNodes.sort((a, b) => {
      const aPriority = adjustedNodes.get(a.nodeId) ?? a.priority;
      const bPriority = adjustedNodes.get(b.nodeId) ?? b.priority;
      return bPriority - aPriority;
    });

    const topNode = remainingNodes[0];
    nextRecommendation = {
      nodeId: topNode.nodeId,
      priority: adjustedNodes.get(topNode.nodeId) ?? topNode.priority
    };
  }

  return { adjustments, nextRecommendation };
}

/**
 * Apply micro-adjustments to database
 */
export async function applyMicroAdjustments(
  pathId: string,
  adjustments: MicroAdjustment[]
): Promise<void> {
  // Fetch current path
  const path = await prisma.learningPath.findUnique({
    where: { id: pathId }
  });

  if (!path) {
    throw new Error('路径不存在');
  }

  // Parse and apply adjustments
  const nodes: PathKnowledgeNode[] = JSON.parse(path.knowledgeData as string);
  const adjustmentMap = new Map(adjustments.map(a => [a.nodeId, a.newPriority]));

  for (const node of nodes) {
    const newPriority = adjustmentMap.get(node.nodeId);
    if (newPriority !== undefined) {
      node.priority = newPriority;
    }
  }

  // Re-sort by priority
  nodes.sort((a, b) => b.priority - a.priority);

  // Update database
  await prisma.learningPath.update({
    where: { id: pathId },
    data: {
      knowledgeData: JSON.stringify(nodes)
    }
  });

  // Record adjustment history
  await prisma.pathAdjustment.create({
    data: {
      pathId,
      type: 'micro',
      trigger: 'practice_completed',
      changes: JSON.stringify({
        reordered: adjustments.map(a => ({
          nodeId: a.nodeId,
          oldPriority: a.oldPriority,
          newPriority: a.newPriority
        }))
      })
    }
  });
}
