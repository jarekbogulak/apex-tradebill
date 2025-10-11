import type { FastifyPluginAsync } from 'fastify';
import { createEquityService } from '../../services/accounts/equityService.js';
import { createErrorResponse, errorResponseSchema, resolveUserId } from '../http.js';

type EquityService = ReturnType<typeof createEquityService>;

interface GetEquityRouteOptions {
  equityService: EquityService;
}

export const getEquityRoute: FastifyPluginAsync<GetEquityRouteOptions> = async (
  app,
  { equityService },
) => {
  app.get(
    '/v1/accounts/equity',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['source', 'equity', 'lastSyncedAt'],
            properties: {
              source: { type: 'string', enum: ['connected', 'manual'] },
              equity: { type: 'string' },
              lastSyncedAt: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = resolveUserId(request);
        const snapshot = await equityService.getLatestEquity(userId);
        return reply.send({
          source: snapshot.source,
          equity: snapshot.equity,
          lastSyncedAt: snapshot.lastSyncedAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to fetch equity';
        if (message.includes('No equity snapshot')) {
          return reply
            .status(404)
            .send(createErrorResponse('NOT_FOUND', 'No equity snapshot available'));
        }

        return reply.status(400).send(createErrorResponse('EQUITY_ERROR', message));
      }
    },
  );
};

export default getEquityRoute;
