/**
 * PromotionPipeline - Promote generated questions to Question table
 */

import { prisma } from '@/lib/prisma';

export interface PromotionResult {
  questionId: string | null;
  success: boolean;
  error?: string;
}

export class PromotionPipeline {
  /**
   * Promote a single generated question to the Question table
   */
  async promoteToQuestion(generatedQuestionId: string): Promise<PromotionResult> {
    const generated = await prisma.generatedQuestion.findUnique({
      where: { id: generatedQuestionId },
    });

    if (!generated) {
      return { questionId: null, success: false, error: 'GeneratedQuestion not found' };
    }

    // Parse complexity spec for difficulty estimation
    let complexitySpec: { structure?: string; depth?: number; distraction?: number } = {};
    try {
      complexitySpec = JSON.parse(generated.complexitySpec || '{}');
    } catch {
      // Use defaults if parsing fails
    }

    // Create the Question record
    const question = await prisma.question.create({
      data: {
        type: generated.type,
        content: generated.content,
        answer: generated.answer,
        hint: generated.hint ?? undefined,
        difficulty: this.estimateDifficulty(complexitySpec),
        knowledgePoints: JSON.stringify(['一元一次方程']),
        generatedFrom: generated.id,
        complexitySpec: generated.complexitySpec,
      },
    });

    // Update the GeneratedQuestion promotion status
    await prisma.generatedQuestion.update({
      where: { id: generatedQuestionId },
      data: {
        promotionStatus: 'PASSED',
        promotedAt: new Date(),
      },
    });

    return { questionId: question.id, success: true };
  }

  /**
   * Estimate difficulty based on complexity spec
   * Structure score: linear=1, nested=2, multi_equation=3, constraint_chain=4
   * Raw score = structureScore + depthScore + distractionScore
   * Difficulty = clamp(raw / 2, 1, 5)
   */
  private estimateDifficulty(spec: {
    structure?: string;
    depth?: number;
    distraction?: number;
  }): number {
    const structureScore: Record<string, number> = {
      linear: 1,
      nested: 2,
      multi_equation: 3,
      constraint_chain: 4,
    };

    const structure = spec.structure ?? 'linear';
    const depth = spec.depth ?? 1;
    const distraction = spec.distraction ?? 0;

    const raw =
      (structureScore[structure] ?? 1) + depth + distraction;

    return Math.min(5, Math.max(1, Math.floor(raw / 2)));
  }

  /**
   * Promote all pending questions from a batch
   */
  async promoteBatch(
    batchId: string
  ): Promise<{ passed: number; failed: number; results: PromotionResult[] }> {
    const questions = await prisma.generatedQuestion.findMany({
      where: { batchId, promotionStatus: 'PENDING' },
    });

    let passed = 0;
    let failed = 0;
    const results: PromotionResult[] = [];

    for (const q of questions) {
      try {
        const result = await this.promoteToQuestion(q.id);
        if (result.success) {
          passed++;
        } else {
          failed++;
        }
        results.push(result);
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ questionId: null, success: false, error: errorMessage });

        // Mark as failed in the database
        await prisma.generatedQuestion.update({
          where: { id: q.id },
          data: {
            promotionStatus: 'FAILED',
            auditReason: errorMessage,
          },
        });
      }
    }

    return { passed, failed, results };
  }
}
