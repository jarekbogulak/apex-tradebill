import {
  MarketSnapshotSchema,
  TradeExecutionMethodSchema,
  TradeInputSchema,
  TradeOutputSchema,
  TradeSourceSchema,
} from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
  ImportTradeHistoryUseCase,
  TradeHistoryImportEntry,
} from '@api/domain/trading/tradeHistory.usecases.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
} from '@api/adapters/http/fastify/shared/http.js';

interface PostHistoryImportRouteOptions {
  importTradeHistory: ImportTradeHistoryUseCase;
}

const DeviceCacheImportSchema = z.object({
  id: z.string().min(1),
  input: TradeInputSchema,
  output: TradeOutputSchema,
  marketSnapshot: MarketSnapshotSchema,
  source: TradeSourceSchema.optional(),
  createdAt: z.string().datetime(),
  executionMethod: TradeExecutionMethodSchema.optional(),
  executedAt: z.string().datetime().optional(),
});

const BodySchema = z.object({
  entries: z.array(DeviceCacheImportSchema).min(1),
});

export const postHistoryImportRoute: FastifyPluginAsync<PostHistoryImportRouteOptions> = async (
  app,
  { importTradeHistory },
) => {
  app.post(
    '/v1/trades/history/import',
    {
      schema: {
        body: {
          type: 'object',
          required: ['entries'],
          properties: {
            entries: {
              type: 'array',
              items: { type: 'object' },
              minItems: 1,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['syncedIds'],
            properties: {
              syncedIds: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parseResult = BodySchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map(
          (issue) => `${issue.path.join('.') || 'entries'} ${issue.message}`,
        );
        return reply
          .status(400)
          .send(createErrorResponse('VALIDATION_ERROR', 'Invalid import payload', details));
      }

      const userId = resolveUserId(request);
      const normalizedEntries: TradeHistoryImportEntry[] = parseResult.data.entries.map(
        (entry) => ({
          ...entry,
          input: {
            ...entry.input,
            accountEquitySource: entry.input.accountEquitySource ?? 'connected',
          },
        }),
      );
      const result = await importTradeHistory(userId, normalizedEntries);

      for (const failure of result.failures) {
        app.log.warn(
          { err: failure.error, entryId: failure.id },
          'trade_history.import_entry_failed',
        );
      }

      return reply.send({
        syncedIds: result.syncedIds,
      });
    },
  );
};

export default postHistoryImportRoute;
