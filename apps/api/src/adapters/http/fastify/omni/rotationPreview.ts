import type { FastifyPluginAsync } from 'fastify';
import { createErrorResponse, errorResponseSchema } from '../shared/http.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import { RotationInProgressError } from '@api/modules/omniSecrets/service.js';
import { ensureOperator } from './authz.js';

interface RotationPreviewRouteOptions {
  service: OmniSecretService;
}

interface RotationPreviewBody {
  secretType: string;
  gcpSecretVersion?: string;
}

export const omniRotationPreviewRoute: FastifyPluginAsync<RotationPreviewRouteOptions> = async (
  app,
  { service },
) => {
  app.post<{
    Body: RotationPreviewBody;
  }>(
    '/ops/apex-omni/secrets/rotation-preview',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['secretType', 'gcpSecretVersion'],
          properties: {
            secretType: { type: 'string' },
            gcpSecretVersion: { type: 'string' },
            dryRunWebhookUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['validated', 'latencyMs', 'version'],
            properties: {
              validated: { type: 'boolean' },
              latencyMs: { type: 'number' },
              version: { type: 'string' },
            },
          },
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!ensureOperator(request, reply)) {
        return reply;
      }

      try {
        const result = await service.rotationPreview({
          secretType: request.body.secretType,
          gcpSecretVersion: request.body.gcpSecretVersion,
        });
        return reply.send(result);
      } catch (error) {
        if (error instanceof RotationInProgressError) {
          return reply
            .status(409)
            .send(
              createErrorResponse('ROTATION_IN_PROGRESS', `Rotation already running for ${request.body.secretType}`),
            );
        }
        throw error;
      }
    },
  );
};

export default omniRotationPreviewRoute;
