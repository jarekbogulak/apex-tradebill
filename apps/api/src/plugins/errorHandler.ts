import type { FastifyPluginAsync } from 'fastify';
import { createErrorResponse } from '../adapters/http/fastify/shared/http.js';
import {
  InvalidBreakGlassTtlError,
  SecretUnavailableError,
} from '@api/modules/omniSecrets/service.js';

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof InvalidBreakGlassTtlError) {
      return reply.status(422).send(createErrorResponse('INVALID_BREAK_GLASS_TTL', error.message));
    }

    if (error instanceof SecretUnavailableError) {
      return reply.status(503).send(createErrorResponse('OMNI_SECRET_UNAVAILABLE', error.message));
    }

    app.log.error({ err: error }, 'unhandled_error');
    return reply.status(500).send(createErrorResponse('INTERNAL_ERROR', 'Unexpected server error.'));
  });
};

export default errorHandlerPlugin;
