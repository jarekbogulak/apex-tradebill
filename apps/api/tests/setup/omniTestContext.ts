import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

type EnvOverrides = Record<string, string | undefined>;

export interface OmniTestContext {
  app: FastifyInstance;
    request: {
        get: (url: string) => TestRequest;
        post: (url: string) => TestRequest;
        patch: (url: string) => TestRequest;
        del: (url: string) => TestRequest;
    };
  close: () => Promise<void>;
}

export interface CreateOmniTestContextOptions {
  env?: EnvOverrides;
}

const applyEnvOverrides = (overrides: EnvOverrides | undefined) => {
  if (!overrides) {
    return () => {};
  }

  const snapshot: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    snapshot[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
};

type TestRequest = {
    set(key: string, value: string): TestRequest;
    send(body?: unknown): Promise<{
        status: number;
        body: unknown;
        headers: Record<string, string>;
        text: string;
    }>;
};

const createInjectRequest = (app: FastifyInstance, method: string, url: string): TestRequest => {
    const headers: Record<string, string> = { host: 'localhost:80' };
    let payload: unknown;
    return {
        set(key, value) {
            headers[key.toLowerCase()] = value;
            headers[key] = value;
            return this;
        },
        async send(body) {
            payload = body ?? payload;
            const response = await app.inject({
                method,
                url,
                headers,
                payload,
            });
            return {
                status: response.statusCode,
                body: (() => {
                    try {
                        return response.json();
                    } catch {
                        try {
                            return JSON.parse(response.body as string);
                        } catch {
                            return response.body;
                        }
                    }
                })(),
                headers: response.headers as Record<string, string>,
                text: response.body as string,
            };
        },
    };
};

export const createOmniTestContext = async (
  options?: CreateOmniTestContextOptions,
): Promise<OmniTestContext> => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

    const baseOverrides: EnvOverrides = {
        APEX_ALLOW_IN_MEMORY_DB: 'true',
        APEX_ALLOW_IN_MEMORY_MARKET_DATA: 'true',
        APEX_FORCE_IN_MEMORY_DB: 'true',
        SUPABASE_DB_URL: undefined,
        DATABASE_URL: undefined,
        APEX_OMNI_API_KEY: undefined,
        APEX_OMNI_API_SECRET: undefined,
        APEX_OMNI_API_PASSPHRASE: undefined,
        APEX_OMNI_REST_URL: undefined,
        APEX_OMNI_WS_URL: undefined,
    };

    const restoreEnv = applyEnvOverrides({ ...baseOverrides, ...options?.env });
  const app = await buildServer();
    // In tests, ensure Authorization headers populate auth context even if upstream plugin is skipped.
    app.addHook('onRequest', async (request) => {
        if (process.env.NODE_ENV === 'test' && !request.auth) {
            const authHeader = request.headers.authorization;
            if (authHeader?.toLowerCase().startsWith('bearer ')) {
                const token = authHeader.split(' ')[1] ?? '';
                request.auth = {
                    userId: 'ops-user',
                    token,
                    claims: {},
                };
            }
        }
    });
    const request = {
        get: (url: string) => createInjectRequest(app, 'GET', url),
        post: (url: string) => createInjectRequest(app, 'POST', url),
        patch: (url: string) => createInjectRequest(app, 'PATCH', url),
        del: (url: string) => createInjectRequest(app, 'DELETE', url),
    };

  const close = async () => {
    await app.close();
    restoreEnv();
  };

  return { app, request, close };
};

declare global {
  var createOmniTestContext: typeof createOmniTestContext;
}

globalThis.createOmniTestContext = createOmniTestContext;

export {};
