import {
  MarketSnapshotSchema,
  TradeExecutionMethodSchema,
  TradeInputSchema,
  TradeOutputSchema,
  TradeSourceSchema,
} from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createTradeCalculation,
  type TradeCalculationRepository,
} from '../../domain/trade-calculation/trade-calculation.entity.js';
import { createErrorResponse, errorResponseSchema, resolveUserId } from '../http.js';

interface PostHistoryImportRouteOptions {
  tradeCalculations: TradeCalculationRepository;
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
type DeviceCacheImport = z.infer<typeof DeviceCacheImportSchema>;

const BodySchema = z.object({
  entries: z.array(DeviceCacheImportSchema).min(1),
});

export const postHistoryImportRoute: FastifyPluginAsync<PostHistoryImportRouteOptions> = async (
  app,
  { tradeCalculations },
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
      const syncedIds: string[] = [];

      for (const rawEntry of parseResult.data.entries) {
        const entry: DeviceCacheImport = rawEntry;
        try {
          const calculation = createTradeCalculation({
            userId,
            input: entry.input,
            output: entry.output,
            marketSnapshot: entry.marketSnapshot,
            source: entry.source ?? 'manual',
            createdAt: entry.createdAt,
            executionMethod: entry.executionMethod ?? 'history-import',
            executedAt: entry.executedAt ?? entry.createdAt,
          });
          await tradeCalculations.save(calculation);
          syncedIds.push(entry.id);
        } catch (error) {
          app.log.warn(
            { err: error, entryId: entry.id },
            'trade_history.import_entry_failed',
          );
        }
      }

      return reply.send({
        syncedIds,
      });
    },
  );
};

export default postHistoryImportRoute;
