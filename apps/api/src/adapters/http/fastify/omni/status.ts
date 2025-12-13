import type { FastifyPluginAsync } from 'fastify';
import { errorResponseSchema } from '../shared/http.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import { ensureOperator } from './authz.js';

interface OmniStatusRouteOptions {
  service: OmniSecretService;
}

export const omniStatusRoute: FastifyPluginAsync<OmniStatusRouteOptions> = async (
  app,
  { service },
) => {
  app.get('/ops/apex-omni/secrets/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['data', 'updatedAt'],
          properties: {
            updatedAt: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['secretType', 'status', 'cacheSource'],
                properties: {
                  secretType: { type: 'string' },
                  status: { type: 'string' },
                  cacheSource: { type: 'string' },
                  cacheVersion: { type: ['string', 'null'] },
                  cacheAgeSeconds: { type: ['number', 'null'] },
                  rotationDueAt: { type: ['string', 'null'] },
                  lastRotatedAt: { type: ['string', 'null'] },
                  lastValidatedAt: { type: ['string', 'null'] },
                  breakGlassEnabledUntil: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    if (!ensureOperator(request, reply)) {
      return reply;
    }

    const result = await service.getStatus();
    return reply.send(result);
  });
};

export default omniStatusRoute;
