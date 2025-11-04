import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { createErrorResponse, errorResponseSchema } from './http.js';
import type { DeviceAuthService } from '../services/deviceAuthService.js';

interface PostDeviceRegisterOptions {
  deviceAuthService: DeviceAuthService | null;
}

const BodySchema = z.object({
  deviceId: z.string().min(1),
  activationCode: z.string().min(1),
});

export const postDeviceRegisterRoute: FastifyPluginAsync<PostDeviceRegisterOptions> = async (
  app,
  { deviceAuthService },
) => {
  app.post(
    '/v1/auth/device/register',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['deviceId', 'activationCode'],
          properties: {
            deviceId: { type: 'string' },
            activationCode: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['userId', 'deviceId', 'token', 'tokenExpiresAt'],
            properties: {
              userId: { type: 'string', format: 'uuid' },
              deviceId: { type: 'string' },
              token: { type: 'string' },
              tokenExpiresAt: { type: 'string', format: 'date-time' },
            },
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (!deviceAuthService) {
        return reply
          .status(503)
          .send(
            createErrorResponse('DEVICE_AUTH_UNAVAILABLE', 'Device registration is unavailable'),
          );
      }

      const parseResult = BodySchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map(
          (issue) => `${issue.path.join('.') || 'body'} ${issue.message}`,
        );
        return reply
          .status(400)
          .send(createErrorResponse('VALIDATION_ERROR', 'Invalid activation payload', details));
      }

      try {
        const result = await deviceAuthService.registerDevice({
          deviceId: parseResult.data.deviceId,
          activationCode: parseResult.data.activationCode,
          ipAddress: request.ip,
        });

        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to register device';
        const code = message.includes('expired')
          ? 'ACTIVATION_EXPIRED'
          : message.includes('mismatch')
            ? 'ACTIVATION_INVALID'
            : message.includes('used')
              ? 'ACTIVATION_CONSUMED'
              : 'DEVICE_REGISTRATION_FAILED';
        const status =
          code === 'ACTIVATION_EXPIRED'
            ? 403
            : code === 'ACTIVATION_INVALID'
              ? 400
              : code === 'ACTIVATION_CONSUMED'
                ? 409
                : 400;
        return reply.status(status).send(createErrorResponse(code, message));
      }
    },
  );
};

export default postDeviceRegisterRoute;
