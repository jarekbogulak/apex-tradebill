import type { FastifyPluginAsync } from 'fastify';
import type { TradeHistoryManager } from '@api/domain/trading/tradeHistory.usecases.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
  sendValidationError,
} from '@api/adapters/http/fastify/shared/http.js';

interface GetHistoryRouteOptions {
  tradeHistory: TradeHistoryManager;
}

interface HistoryQuery {
  limit?: string;
  cursor?: string;
}

export const getHistoryRoute: FastifyPluginAsync<GetHistoryRouteOptions> = async (
  app,
  { tradeHistory },
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
                // Relaxing additionalProperties stopped Fastify from erasing the payload, but it’s really just a stop-gap. If we want strong guarantees, this schema should mirror the exact TradeCalculation DTO (id, userId, executionMethod, …) plus nested input, output, and marketSnapshot shapes
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
              nextCursor: {
                type: ['string', 'null'],
              },
            },
          },
          400: errorResponseSchema,
          503: errorResponseSchema,
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

      if (!tradeHistory.isPersistent) {
        request.log.error('trade_history.persistence_unavailable');
        return reply
          .status(503)
          .send(
            createErrorResponse(
              'HISTORY_UNAVAILABLE',
              'Trade history is temporarily unavailable. Please try again later.',
            ),
          );
      }

      try {
        const userId = resolveUserId(request);
        const history = await tradeHistory.list(userId, limit, cursor ?? null);
        request.log.info(
          {
            userId,
            limit,
            cursor,
            itemCount: history.items.length,
            nextCursor: history.nextCursor,
          },
          'trade_history.list_success',
        );
        return reply.send({
          items: history.items,
          nextCursor: history.nextCursor,
        });
      } catch (error) {
        request.log.error(
          {
            err: error,
            limit,
            cursor,
          },
          'trade_history.list_failed',
        );
        const message = error instanceof Error ? error.message : 'Unable to load history';
        return reply.status(400).send(createErrorResponse('HISTORY_ERROR', message));
      }
    },
  );
};

export default getHistoryRoute;
