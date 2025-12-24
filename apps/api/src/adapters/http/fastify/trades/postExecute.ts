import { TradeInputSchema } from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import type { ExecuteTradeUseCase } from '@api/domain/trading/tradePreview.usecases.js';
import { MarketDataUnavailableError } from '@api/adapters/streaming/marketData/errors.js';
import {
  createErrorResponse,
  errorResponseSchema,
  resolveUserId,
  sendValidationError,
} from '@api/adapters/http/fastify/shared/http.js';

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
} as const;

const tradeWarningCodeJsonSchema = {
  type: 'string',
  enum: [
    'ATR_STALE',
    'INSUFFICIENT_EQUITY',
    'MIN_LOT_SIZE',
    'MIN_NOTIONAL',
    'STOP_OUTSIDE_RANGE',
    'TARGET_OUTSIDE_RANGE',
    'VOLATILITY_STOP_GREATER',
  ],
} as const;

const tradeOutputJsonSchema = {
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
      items: tradeWarningCodeJsonSchema,
    },
  },
} as const;

const marketSnapshotJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['symbol', 'lastPrice', 'atr13', 'atrMultiplier', 'stale', 'source', 'serverTimestamp'],
  properties: {
    symbol: { type: 'string' },
    lastPrice: { type: 'string' },
    bid: nullableStringSchema,
    ask: nullableStringSchema,
    atr13: { type: 'string' },
    atrMultiplier: { type: 'string' },
    stale: { type: 'boolean' },
    source: { type: 'string', enum: ['stream', 'manual'] },
    serverTimestamp: { type: 'string', format: 'date-time' },
  },
} as const;

const tradeInputJsonSchema = {
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
    'accountEquitySource',
  ],
  properties: {
    symbol: { type: 'string' },
    direction: { type: 'string', enum: ['long', 'short'] },
    accountSize: { type: 'string' },
    entryPrice: nullableStringSchema,
    stopPrice: nullableStringSchema,
    targetPrice: { type: 'string' },
    riskPercent: { type: 'string' },
    atrMultiplier: { type: 'string' },
    useVolatilityStop: { type: 'boolean' },
    timeframe: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h', '4h'] },
    accountEquitySource: { type: 'string', enum: ['connected', 'manual'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const tradeCalculationJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'userId',
    'executionMethod',
    'executedAt',
    'input',
    'output',
    'marketSnapshot',
    'source',
    'createdAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    executionMethod: { type: 'string', enum: ['execute-button', 'history-import'] },
    executedAt: { type: 'string', format: 'date-time' },
    input: tradeInputJsonSchema,
    output: tradeOutputJsonSchema,
    marketSnapshot: marketSnapshotJsonSchema,
    source: { type: 'string', enum: ['live', 'manual'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const executeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['calculation', 'output', 'marketSnapshot', 'warnings'],
  properties: {
    calculation: tradeCalculationJsonSchema,
    output: tradeOutputJsonSchema,
    marketSnapshot: marketSnapshotJsonSchema,
    warnings: {
      type: 'array',
      items: tradeWarningCodeJsonSchema,
    },
  },
} as const;

interface PostExecuteRouteOptions {
  executeTrade: ExecuteTradeUseCase;
}

export const postExecuteRoute: FastifyPluginAsync<PostExecuteRouteOptions> = async (
  app,
  { executeTrade },
) => {
  app.post(
    '/v1/trades/execute',
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
            entryPrice: nullableStringSchema,
            stopPrice: nullableStringSchema,
            targetPrice: { type: 'string' },
            riskPercent: { type: 'string' },
            atrMultiplier: { type: 'string' },
            useVolatilityStop: { type: 'boolean' },
            timeframe: { type: 'string' },
            accountEquitySource: { type: 'string', enum: ['connected', 'manual'] },
          },
        },
        response: {
          200: executeResponseSchema,
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
        const result = await executeTrade(userId, parseResult.data);

        return reply.send({
          calculation: result.calculation,
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

        return reply.status(400).send(createErrorResponse('EXECUTE_FAILED', message));
      }
    },
  );
};

export default postExecuteRoute;
