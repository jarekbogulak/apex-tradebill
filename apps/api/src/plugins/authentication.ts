import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import {
  createErrorResponse,
  DEFAULT_USER_ID,
} from '../adapters/http/fastify/shared/http.js';

type JwtHeader = {
  alg: string;
  typ: string;
  [key: string]: unknown;
};

interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  deviceId?: string;
  [key: string]: unknown;
}

export interface AuthenticationPluginOptions {
  secret: string;
  issuer?: string;
  audience?: string;
  clockToleranceMs?: number;
  allowGuest?: boolean;
}

export interface AuthContext {
  userId: string;
  token: string;
  claims: JwtClaims;
  deviceId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const base64UrlDecode = (segment: string): string => {
  const padding = 4 - (segment.length % 4);
  const normalized =
    segment.replace(/-/g, '+').replace(/_/g, '/') + (padding < 4 ? '='.repeat(padding) : '');
  return Buffer.from(normalized, 'base64').toString('utf8');
};

const isAudienceValid = (
  expected: string | undefined,
  actual: string | string[] | undefined,
): boolean => {
  if (!expected || !actual) {
    return true;
  }

  if (Array.isArray(actual)) {
    return actual.includes(expected);
  }

  return actual === expected;
};

const verifyJwt = (token: string, secret: string): { header: JwtHeader; claims: JwtClaims } => {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid token structure');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const header = JSON.parse(base64UrlDecode(encodedHeader)) as JwtHeader;
  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtClaims;

  if (header.alg !== 'HS256') {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw new Error('JWT signature mismatch');
  }

  return {
    header,
    claims: payload,
  };
};

const isTokenActive = (claims: JwtClaims, toleranceMs: number): boolean => {
  const nowSeconds = Date.now() / 1000;

  if (claims.nbf && nowSeconds + toleranceMs / 1000 < claims.nbf) {
    return false;
  }

  if (claims.exp && nowSeconds - toleranceMs / 1000 > claims.exp) {
    return false;
  }

  return true;
};

const resolveUserIdFromClaims = (claims: JwtClaims): string | null => {
  if (claims.sub && typeof claims.sub === 'string') {
    return claims.sub;
  }

  if (claims.userId && typeof claims.userId === 'string') {
    return claims.userId;
  }

  return null;
};

const forbid = (reply: FastifyReply, message: string) => {
  void reply.status(401).send(createErrorResponse('UNAUTHENTICATED', message));
};

export const authenticationPlugin: FastifyPluginAsync<AuthenticationPluginOptions> = async (
  app,
  { secret, issuer, audience, clockToleranceMs = 5000, allowGuest = true },
) => {
  if (!secret) {
    throw new Error('Authentication secret must be provided');
  }

  app.decorateRequest('auth', undefined as AuthContext | undefined);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = request.headers.authorization;
    if (!authorization) {
      if (allowGuest) {
        request.auth = {
          userId: DEFAULT_USER_ID,
          token: 'guest',
          claims: {},
        };
        request.headers['x-user-id'] = DEFAULT_USER_ID;
        return;
      }
      forbid(reply, 'Authorization header missing');
      return reply;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      forbid(reply, 'Authorization header must be a Bearer token');
      return reply;
    }

    try {
      const { claims } = verifyJwt(token, secret);

      if (issuer && claims.iss && claims.iss !== issuer) {
        throw new Error('JWT issuer mismatch');
      }

      if (!isAudienceValid(audience, claims.aud)) {
        throw new Error('JWT audience mismatch');
      }

      if (!isTokenActive(claims, clockToleranceMs)) {
        throw new Error('JWT is expired or not yet valid');
      }

      const userId = resolveUserIdFromClaims(claims);
      if (!userId) {
        throw new Error('JWT is missing required subject claim');
      }

      const deviceHeader = request.headers['x-device-id'];
      if (claims.deviceId && deviceHeader && typeof deviceHeader === 'string') {
        if (claims.deviceId !== deviceHeader) {
          throw new Error('Device identifier mismatch');
        }
      }

      request.auth = {
        userId,
        token,
        claims,
        deviceId: typeof claims.deviceId === 'string' ? claims.deviceId : undefined,
      };

      request.headers['x-user-id'] = userId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      app.log.warn({ err: error }, 'authentication.validation_failed');
      forbid(reply, message);
      return reply;
    }
  });
};

export default authenticationPlugin;
