import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('Omni break-glass flow', () => {
  it('switches cache source to break_glass until TTL expires', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const operatorToken = createOperatorJwt({ scope: ['ops.omni.secrets.breakglass'] });
      const statusToken = createOperatorJwt({ scope: ['ops.omni.secrets.read'] });

      const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const response = await ctx.request
        .post('/ops/apex-omni/secrets/break-glass')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          secretType: 'trading_api_key',
          ciphertext: 'encrypted-secret',
          expiresAt,
        });

      expect(response.status).toBe(201);

      const statusResponse = await ctx.request
        .get('/ops/apex-omni/secrets/status')
        .set('Authorization', `Bearer ${statusToken}`)
        .send();

      const entry = (statusResponse.body.data ?? []).find(
        (item: { secretType: string }) => item.secretType === 'trading_api_key',
      );
      expect(entry?.cacheSource).toBe('break_glass');
    } finally {
      await ctx.close();
    }
  });
});
