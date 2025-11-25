import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createErrorResponse, errorResponseSchema } from '../shared/http.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import {
  InvalidBreakGlassTtlError,
  InvalidBreakGlassPayloadError,
  SecretUnavailableError,
} from '@api/modules/omniSecrets/service.js';

interface BreakGlassRouteOptions {
  service: OmniSecretService;
}

interface BreakGlassBody {
  secretType: string;
  ciphertext: string;
  expiresAt: string;
}

const ensureAuthenticated = (request: FastifyRequest, reply: FastifyReply): boolean => {
  if (!request.auth || request.auth.token === 'guest') {
    void reply.status(401).send(createErrorResponse('UNAUTHENTICATED', 'Operator token required'));
    return false;
  }
  return true;
};

export const omniBreakGlassRoute: FastifyPluginAsync<BreakGlassRouteOptions> = async (
  app,
  { service },
) => {
  app.post<{
    Body: BreakGlassBody;
  }>(
    '/ops/apex-omni/secrets/break-glass',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['secretType', 'ciphertext', 'expiresAt'],
          properties: {
            secretType: { type: 'string' },
            ciphertext: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['secretType', 'expiresAt'],
            properties: {
              secretType: { type: 'string' },
              expiresAt: { type: 'string' },
            },
          },
          401: errorResponseSchema,
          422: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!ensureAuthenticated(request, reply)) {
        return reply;
      }

      try {
        const result = await service.applyBreakGlass({
          secretType: request.body.secretType,
          ciphertext: request.body.ciphertext,
          expiresAt: request.body.expiresAt,
          actorId: request.auth?.userId ?? 'unknown',
        });
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof InvalidBreakGlassTtlError) {
          return reply
            .status(422)
            .send(createErrorResponse('INVALID_BREAK_GLASS_TTL', error.message));
        }
        if (error instanceof InvalidBreakGlassPayloadError) {
          return reply
            .status(422)
            .send(createErrorResponse('INVALID_BREAK_GLASS_PAYLOAD', error.message));
        }
        if (error instanceof SecretUnavailableError) {
          return reply
            .status(503)
            .send(createErrorResponse('OMNI_SECRET_UNAVAILABLE', error.message));
        }
        throw error;
      }
    },
  );
};

export default omniBreakGlassRoute;
