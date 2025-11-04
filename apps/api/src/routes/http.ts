import type { FastifyReply, FastifyRequest } from 'fastify';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: string[];
}

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    details: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

export const createErrorResponse = (
  code: string,
  message: string,
  details?: string[],
): ErrorResponse => {
  return {
    code,
    message,
    ...(details && details.length > 0 ? { details } : {}),
  };
};

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

export const resolveUserId = (request: FastifyRequest): string => {
  if (request.auth?.userId) {
    return request.auth.userId;
  }

  const header = request.headers['x-user-id'];
  if (!header) {
    return DEFAULT_USER_ID;
  }

  if (Array.isArray(header)) {
    return header[0] ?? DEFAULT_USER_ID;
  }

  return header;
};

export const sendValidationError = (reply: FastifyReply, message: string, details?: string[]) => {
  return reply.status(400).send(createErrorResponse('VALIDATION_ERROR', message, details));
};

export const sendNotFound = (reply: FastifyReply, message: string) => {
  return reply.status(404).send(createErrorResponse('NOT_FOUND', message));
};
