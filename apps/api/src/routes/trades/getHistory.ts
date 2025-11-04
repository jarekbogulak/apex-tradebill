import type { FastifyPluginAsync } from 'fastify';
import type { TradeHistoryService } from '../../services/trades/historyService.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
  sendValidationError,
} from '../http.js';

interface GetHistoryRouteOptions {
  historyService: TradeHistoryService;
}

interface HistoryQuery {
  limit?: string;
  cursor?: string;
}

export const getHistoryRoute: FastifyPluginAsync<GetHistoryRouteOptions> = async (
  app,
  { historyService },
) => {
  app.get<{
    Querystring: HistoryQuery;
  }>(
    '/v1/trades/history',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'string' },
            cursor: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: { type: 'object' },
              },
              nextCursor: {
                type: ['string', 'null'],
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit: rawLimit, cursor = null } = request.query;

      let limit = 20;
      if (rawLimit != null) {
        limit = Number.parseInt(rawLimit, 10);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
          return sendValidationError(reply, 'Limit must be an integer between 1 and 100');
        }
      }

      try {
        const userId = resolveUserId(request);
        const history = await historyService.list(userId, limit, cursor ?? null);
        return reply.send({
          items: history.items,
          nextCursor: history.nextCursor,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load history';
        return reply.status(400).send(createErrorResponse('HISTORY_ERROR', message));
      }
    },
  );
};

export default getHistoryRoute;
