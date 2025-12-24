import { TradeInputSchema } from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import type { PreviewTradeUseCase } from '@api/domain/trading/tradePreview.usecases.js';
import { MarketDataUnavailableError } from '@api/adapters/streaming/marketData/errors.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
  sendValidationError,
} from '@api/adapters/http/fastify/shared/http.js';

interface PostPreviewRouteOptions {
  previewTrade: PreviewTradeUseCase;
}

export const postPreviewRoute: FastifyPluginAsync<PostPreviewRouteOptions> = async (
  app,
  { previewTrade },
) => {
  app.post(
    '/v1/trades/preview',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: [
            'symbol',
            'direction',
            'accountSize',
            'targetPrice',
            'riskPercent',
            'atrMultiplier',
            'useVolatilityStop',
            'timeframe',
          ],
          properties: {
            symbol: { type: 'string' },
            direction: { type: 'string', enum: ['long', 'short'] },
            accountSize: { type: 'string' },
            entryPrice: { type: ['string', 'null'] },
            stopPrice: { type: ['string', 'null'] },
            targetPrice: { type: 'string' },
            riskPercent: { type: 'string' },
            atrMultiplier: { type: 'string' },
            useVolatilityStop: { type: 'boolean' },
            timeframe: { type: 'string' },
            accountEquitySource: { type: 'string', enum: ['connected', 'manual'] },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['output', 'marketSnapshot', 'warnings'],
            properties: {
              output: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'positionSize',
                  'positionCost',
                  'riskAmount',
                  'riskToReward',
                  'suggestedStop',
                  'atr13',
                  'warnings',
                ],
                properties: {
                  positionSize: { type: 'string' },
                  positionCost: { type: 'string' },
                  riskAmount: { type: 'string' },
                  riskToReward: { type: 'number' },
                  suggestedStop: { type: 'string' },
                  atr13: { type: 'string' },
                  warnings: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
              marketSnapshot: {
                type: 'object',
                required: [
                  'symbol',
                  'lastPrice',
                  'atr13',
                  'atrMultiplier',
                  'stale',
                  'source',
                  'serverTimestamp',
                ],
                properties: {
                  symbol: { type: 'string' },
                  lastPrice: { type: 'string' },
                  bid: { type: ['string', 'null'] },
                  ask: { type: ['string', 'null'] },
                  atr13: { type: 'string' },
                  atrMultiplier: { type: 'string' },
                  stale: { type: 'boolean' },
                  source: { type: 'string' },
                  serverTimestamp: { type: 'string' },
                },
              },
              warnings: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parseResult = TradeInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map(
          (issue) => `${issue.path.join('.')} ${issue.message}`,
        );
        return sendValidationError(reply, 'Trade input failed validation', details);
      }

      try {
        const userId = resolveUserId(request);
        const result = await previewTrade(userId, parseResult.data);

        return reply.send({
          output: result.output,
          marketSnapshot: result.marketSnapshot,
          warnings: result.warnings,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const details = error.errors.map((issue) => `${issue.path.join('.')} ${issue.message}`);
          return sendValidationError(reply, 'Trade input failed validation', details);
        }

        if (error instanceof MarketDataUnavailableError) {
          return reply
            .status(503)
            .send(createErrorResponse('MARKET_DATA_UNAVAILABLE', error.message, error.details));
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        if (
          message.includes('not available') ||
          message.includes('No market snapshot') ||
          message.includes('not allowlisted')
        ) {
          return reply.status(404).send(createErrorResponse('NOT_FOUND', message));
        }

        return reply.status(400).send(createErrorResponse('PREVIEW_FAILED', message));
      }
    },
  );
};

export default postPreviewRoute;
