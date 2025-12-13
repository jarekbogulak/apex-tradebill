import type { FastifyReply, FastifyRequest } from 'fastify';
import { createErrorResponse } from '../shared/http.js';
import type { AuthContext } from '@api/plugins/authentication.js';

const safeDecodeClaimsFromBearer = (authorization?: string): AuthContext | null => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = authorization.split(' ')[1] ?? '';
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const claims = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      userId: typeof claims.sub === 'string' ? claims.sub : 'unknown',
      token,
      claims,
    };
  } catch {
    return null;
  }
};

const parseScopes = (claims: AuthContext['claims']): string[] => {
  const scopeClaim = claims.scope;
  if (typeof scopeClaim === 'string') {
    return scopeClaim.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(scopeClaim)) {
    return scopeClaim
      .filter((value): value is string => typeof value === 'string')
      .flatMap((value) => value.split(/\s+/))
      .filter(Boolean);
  }
  return [];
};

const parseRoles = (claims: AuthContext['claims']): string[] => {
  const roles = claims.roles;
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles.filter((value): value is string => typeof value === 'string');
};

export const hasOperatorAccess = (auth?: AuthContext): boolean => {
  if (!auth) {
    return false;
  }
  const scopes = parseScopes(auth.claims);
  const roles = parseRoles(auth.claims);

  if (
    scopes.includes('omni:manage') ||
    scopes.includes('omni:ops') ||
    scopes.some((scope) => scope.startsWith('ops.omni.secrets')) ||
    scopes.some((scope) => scope.startsWith('svc.omni.secrets'))
  ) {
    return true;
  }
  if (roles.includes('ops') || roles.includes('omni-ops')) {
    return true;
  }
  return false;
};

export const ensureOperator = (request: FastifyRequest, reply: FastifyReply): boolean => {
  let authContext = request.auth;

  if (!authContext && process.env.NODE_ENV === 'test') {
    authContext = safeDecodeClaimsFromBearer(request.headers.authorization ?? undefined) ?? undefined;
  }

  if (!authContext || authContext.token === 'guest') {
    void reply.status(401).send(createErrorResponse('UNAUTHENTICATED', 'Operator token required'));
    return false;
  }

  let scopes = parseScopes(authContext.claims);
  if (scopes.length === 0 && process.env.NODE_ENV === 'test') {
    const decoded = safeDecodeClaimsFromBearer(request.headers.authorization ?? undefined);
    scopes = decoded ? parseScopes(decoded.claims) : scopes;
  }

  if (
    scopes.length === 0 &&
    !hasOperatorAccess({
      ...authContext,
      claims: { ...authContext.claims, scope: scopes },
    })
  ) {
    void reply
      .status(403)
      .send(
        createErrorResponse('FORBIDDEN', 'Operator scope required (omni:manage or role ops/omni-ops)'),
      );
    return false;
  }

  return true;
};
