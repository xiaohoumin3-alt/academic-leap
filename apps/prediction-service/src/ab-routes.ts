/**
 * A/B Testing HTTP Routes
 *
 * 使用精确路径匹配
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ABTesting, AB_TESTING_ROUTES } from './ab-testing';

export function registerABTestingRoutes(fastify: FastifyInstance, abTesting: ABTesting): void {
  // P2: Use exact path matching instead of includes()

  // GET /experiments - List all experiments
  fastify.get('/experiments', async () => {
    return { experiments: abTesting.getAllExperiments() };
  });

  // GET /experiments/:id/results - Get experiment results
  fastify.get<{ Params: { id: string } }>(
    '/experiments/:id/results',
    async (request, reply) => {
      try {
        const summary = abTesting.getSummary(request.params.id);
        return summary;
      } catch (error) {
        if (error instanceof Error && error.name === 'ExperimentNotFoundError') {
          reply.code(404);
          return { error: error.message };
        }
        throw error;
      }
    }
  );

  // POST /experiments/:id/assign - Assign user to experiment
  fastify.post<{
    Params: { id: string };
    Body: { userId: string };
  }>(
    '/experiments/:id/assign',
    async (request, reply) => {
      const { id } = request.params;
      const { userId } = request.body;

      if (!userId) {
        reply.code(400);
        return { error: 'userId is required' };
      }

      // P10: Input validation
      if (typeof userId !== 'string' || userId.length > 255) {
        reply.code(400);
        return { error: 'Invalid userId format' };
      }

      const variant = await abTesting.assign(id, userId);
      return { experimentId: id, userId, variant };
    }
  );

  // POST /experiments/:id/observe - Record metric observation
  fastify.post<{
    Params: { id: string };
    Body: { userId: string; metricName: string; value: number };
  }>(
    '/experiments/:id/observe',
    async (request, reply) => {
      const { id } = request.params;
      const { userId, metricName, value } = request.body;

      await abTesting.observe({
        experimentId: id,
        userId,
        metricName,
        value
      });

      return { recorded: true };
    }
  );

  // POST /experiments/:id/start - Start experiment
  fastify.post<{ Params: { id: string } }>(
    '/experiments/:id/start',
    async (request) => {
      const success = abTesting.startExperiment(request.params.id);
      return { success };
    }
  );

  // POST /experiments/:id/complete - Complete experiment
  fastify.post<{ Params: { id: string } }>(
    '/experiments/:id/complete',
    async (request) => {
      const success = abTesting.completeExperiment(request.params.id);
      return { success };
    }
  );
}
