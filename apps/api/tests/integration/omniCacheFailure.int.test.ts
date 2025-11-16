import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('Omni cache failure handling', () => {
  it('emits alerts and returns 503 when Google Secret Manager is unreachable', async () => {
    const ctx = await globalThis.createOmniTestContext({
      env: {
        ...defaultTestEnv,
        GCP_PROJECT_ID: 'prod-project',
        OMNI_CACHE_TTL_SECONDS: '1',
      },
    });
    try {
      const token = createOperatorJwt({ scope: ['svc.omni.secrets.cache'] });
      await ctx.request
        .post('/internal/apex-omni/secrets/cache/refresh')
        .set('Authorization', `Bearer ${token}`)
        .send({ secretType: 'trading_api_key' });

      const response = await ctx.request
        .get('/ops/apex-omni/secrets/status')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'OMNI_SECRET_UNAVAILABLE',
        }),
      });
    } finally {
      await ctx.close();
    }
  });
});
