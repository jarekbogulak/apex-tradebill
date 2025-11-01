import type { FastifyPluginAsync } from 'fastify';
import type { createSettingsService } from '../../services/settings/settingsService.js';
import { errorResponseSchema, resolveUserId, sendValidationError } from '../http.js';
import { serializeSettings } from './serialize.js';

type SettingsService = ReturnType<typeof createSettingsService>;

interface GetSettingsRouteOptions {
  settingsService: SettingsService;
}

export const getSettingsRoute: FastifyPluginAsync<GetSettingsRouteOptions> = async (
  app,
  { settingsService },
) => {
  app.get(
    '/v1/settings',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'riskPercent',
              'atrMultiplier',
              'dataFreshnessThresholdMs',
              'defaultSymbol',
              'defaultTimeframe',
              'rememberedMultiplierOptions',
            ],
            properties: {
              riskPercent: { type: 'string' },
              atrMultiplier: { type: 'string' },
              dataFreshnessThresholdMs: { type: 'integer' },
              defaultSymbol: { type: 'string' },
              defaultTimeframe: { type: 'string' },
              rememberedMultiplierOptions: {
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
      const userId = resolveUserId(request);

      try {
        const settings = await settingsService.get(userId);
        return reply.send(serializeSettings(settings));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load settings';
        return sendValidationError(reply, message);
      }
    },
  );
};

export default getSettingsRoute;
