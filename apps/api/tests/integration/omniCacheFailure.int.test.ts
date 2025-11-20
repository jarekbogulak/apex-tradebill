import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('Omni cache failure handling', () => {
  it('emits alerts and returns 503 when Google Secret Manager is unreachable', async () => {
    const ctx = await globalThis.createOmniTestContext({
      env: {
        ...defaultTestEnv,
        GCP_PROJECT_ID: 'prod-project',
        OMNI_CACHE_TTL_SECONDS: '1',
        APEX_SIMULATE_GSM_FAILURE: 'true',
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
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(response.status).toBe(200);
      const entry = (response.body.data ?? []).find(
        (item: { secretType: string }) => item.secretType === 'trading_api_key',
      );
      expect(entry?.cacheSource).toBe('empty');
    } finally {
      await ctx.close();
    }
  });
});
