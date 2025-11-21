import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createErrorResponse, errorResponseSchema } from '../shared/http.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';

interface OmniStatusRouteOptions {
  service: OmniSecretService;
}

const ensureAuthenticated = (request: FastifyRequest, reply: FastifyReply): boolean => {
  if (!request.auth || request.auth.token === 'guest') {
    void reply.status(401).send(createErrorResponse('UNAUTHENTICATED', 'Operator token required'));
    return false;
  }
  return true;
};

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
      },
    },
  }, async (request, reply) => {
    if (!ensureAuthenticated(request, reply)) {
      return reply;
    }

    const result = await service.getStatus();
    return reply.send(result);
  });
};

export default omniStatusRoute;
