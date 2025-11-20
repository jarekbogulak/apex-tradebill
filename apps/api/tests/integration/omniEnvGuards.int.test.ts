import { defaultTestEnv } from '../helpers/omniTestUtils.js';

describe('Omni environment guardrails', () => {
  it('refuses to start when a non-production node tries to reference production GSM secrets', async () => {
    const attempt = async () => {
      const ctxPromise = globalThis.createOmniTestContext({
        env: {
          ...defaultTestEnv,
          NODE_ENV: 'development',
          APEX_OMNI_ENVIRONMENT: 'prod',
          GCP_PROJECT_ID: 'prod-project',
        },
      });
      await ctxPromise.then((ctx) => ctx.close());
    };

    await expect(attempt()).rejects.toThrow(/production/i);
  });
});
