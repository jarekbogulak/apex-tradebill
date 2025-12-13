import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { errorResponseSchema } from '../shared/http.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import { ensureOperator } from './authz.js';

interface CacheRefreshRouteOptions {
  service: OmniSecretService;
}

interface CacheRefreshBody {
  secretType?: string;
}

export const omniCacheRefreshRoute: FastifyPluginAsync<CacheRefreshRouteOptions> = async (
  app,
  { service },
) => {
  app.post<{
    Body: CacheRefreshBody;
  }>(
    '/internal/apex-omni/secrets/cache/refresh',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            secretType: { type: 'string' },
          },
        },
        response: {
          202: {
            type: 'object',
            additionalProperties: false,
            required: ['requestId', 'refreshedSecretTypes'],
            properties: {
              requestId: { type: 'string' },
              refreshedSecretTypes: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!ensureOperator(request, reply)) {
        return reply;
      }

      const result = await service.refreshCache({ secretType: request.body.secretType });
      return reply.status(202).send({
        requestId: crypto.randomUUID(),
        refreshedSecretTypes: result.refreshedSecretTypes,
      });
    },
  );
};

export default omniCacheRefreshRoute;
