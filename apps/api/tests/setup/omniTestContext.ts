import type { FastifyInstance } from 'fastify';
import supertest, { type SuperTest, type Test } from 'supertest';
import { buildServer } from '../../src/server.js';

type EnvOverrides = Record<string, string | undefined>;

export interface OmniTestContext {
  app: FastifyInstance;
  request: SuperTest<Test>;
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

export const createOmniTestContext = async (
  options?: CreateOmniTestContextOptions,
): Promise<OmniTestContext> => {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  const restoreEnv = applyEnvOverrides(options?.env);
  const app = await buildServer();
  const request = supertest(app.server);

  const close = async () => {
    await app.close();
    restoreEnv();
  };

  return { app, request, close };
};

declare global {
  // eslint-disable-next-line no-var
  var createOmniTestContext: typeof createOmniTestContext;
}

globalThis.createOmniTestContext = createOmniTestContext;

export {};
