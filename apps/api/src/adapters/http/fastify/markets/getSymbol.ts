import { SymbolSchema } from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import type { MarketMetadataService } from '@api/domain/markets/marketMetadataService.js';
import {
  createErrorResponse,
  errorResponseSchema,
  sendNotFound,
  sendValidationError,
} from '@api/adapters/http/fastify/shared/http.js';

interface GetSymbolRouteOptions {
  metadata: MarketMetadataService;
}

interface GetSymbolParams {
  symbol: string;
}

export const getSymbolRoute: FastifyPluginAsync<GetSymbolRouteOptions> = async (
  app,
  { metadata },
) => {
  app.get<{
    Params: GetSymbolParams;
  }>(
    '/v1/markets/:symbol',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['symbol'],
          properties: {
            symbol: {
              type: 'string',
              pattern: '^[A-Z]{3,5}-USDT$',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['symbol', 'tickSize', 'stepSize', 'minNotional', 'minQuantity', 'status'],
            properties: {
              symbol: { type: 'string' },
              tickSize: { type: 'string' },
              stepSize: { type: 'string' },
              minNotional: { type: 'string' },
              minQuantity: { type: 'string' },
              status: { type: 'string', enum: ['tradable', 'suspended'] },
              displayName: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedSymbol = SymbolSchema.safeParse(request.params.symbol);
      if (!parsedSymbol.success) {
        return sendValidationError(
          reply,
          'Symbol must match the expected format',
          parsedSymbol.error.errors.map((issue) => issue.message),
        );
      }

      const info = await metadata.getMetadata(parsedSymbol.data);
      if (!info) {
        return sendNotFound(reply, `Symbol ${parsedSymbol.data} is not available`);
      }

      if (info.status !== 'tradable') {
        return reply
          .status(404)
          .send(
            createErrorResponse('NOT_TRADABLE', `Symbol ${info.symbol} is currently suspended`),
          );
      }

      return reply.send({
        symbol: info.symbol,
        tickSize: info.tickSize,
        stepSize: info.stepSize,
        minNotional: info.minNotional,
        minQuantity: info.minQuantity,
        status: info.status,
        ...(info.displayName ? { displayName: info.displayName } : {}),
      });
    },
  );
};

export default getSymbolRoute;
