/**
 * Explanation Routes Module
 * Layer 2 - Provides explanations for prediction results
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { estimateAllAbilities, type Answer } from './explanation/ability-estimator';
import { computeWeakSignals, type AbilityData } from './explanation/weak-signals';
import { generateExplanation } from './explanation/explanation-generator';

interface ExplanationRequest {
  studentId: string;
  questionFeatures?: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

interface ExplanationInput extends ExplanationRequest {
  predictionProbability: number;
  predictionConfidence: number;
  studentAbility: number;
}

type StudentAnswerGetter = (studentId: string) => Promise<Answer[]>;

/**
 * Register explanation routes on the Fastify instance
 */
export function registerExplanationRoutes(
  fastify: FastifyInstance,
  getStudentAnswers: StudentAnswerGetter
): void {

  // GET /students/:studentId/abilities - Get student ability profile
  fastify.get('/students/:studentId/abilities', async (
    request: FastifyRequest<{ Params: { studentId: string } }>,
    _reply: FastifyReply
  ) => {
    const { studentId } = request.params;
    const answers = await getStudentAnswers(studentId);

    return estimateAllAbilities(answers, studentId);
  });

  // GET /students/:studentId/signals - Get weak causal signals
  fastify.get('/students/:studentId/signals', async (
    request: FastifyRequest<{ Params: { studentId: string } }>,
    _reply: FastifyReply
  ) => {
    const { studentId } = request.params;
    const answers = await getStudentAnswers(studentId);

    // Build abilities map from answers
    const nodeStats = new Map<string, { correct: number; total: number }>();
    for (const answer of answers) {
      for (const node of (answer.knowledgeNodes || ['general'])) {
        const stats = nodeStats.get(node) || { correct: 0, total: 0 };
        stats.total++;
        if (answer.correct) stats.correct++;
        nodeStats.set(node, stats);
      }
    }

    const abilities = new Map<string, AbilityData>();
    nodeStats.forEach((stats, nodeId) => {
      abilities.set(nodeId, {
        ability: stats.correct / stats.total,
        sampleSize: stats.total
      });
    });

    return computeWeakSignals(answers, abilities);
  });

  // POST /explain - Generate explanation for a prediction
  fastify.post<{ Body: ExplanationInput }>('/explain', {
    schema: {
      body: {
        type: 'object',
        required: ['studentId', 'predictionProbability', 'predictionConfidence', 'studentAbility'],
        properties: {
          studentId: { type: 'string' },
          predictionProbability: { type: 'number' },
          predictionConfidence: { type: 'number' },
          studentAbility: { type: 'number' },
          questionFeatures: {
            type: 'object',
            properties: {
              difficulty: { type: 'number' },
              knowledgeNodes: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, async (request, _reply: FastifyReply) => {
    const {
      studentId,
      predictionProbability,
      predictionConfidence,
      studentAbility,
      questionFeatures
    } = request.body;

    const answers = await getStudentAnswers(studentId);
    const profile = estimateAllAbilities(answers, studentId);

    return generateExplanation({
      predictionProbability,
      predictionConfidence,
      studentAbility,
      studentAbilityProfile: profile,
      questionFeatures: questionFeatures || { difficulty: 0.5, knowledgeNodes: ['general'] }
    });
  });
}
