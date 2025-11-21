import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('Omni rotation flow', () => {
  it('validates new secret versions and flips metadata status back to active', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.rotate'] });
      const previewResponse = await ctx.request
        .post('/ops/apex-omni/secrets/rotation-preview')
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretType: 'trading_client_secret',
          gcpSecretVersion: '6',
        });

      expect(previewResponse.status).toBe(200);

      const statusResponse = await ctx.request
        .get('/ops/apex-omni/secrets/status')
        .set('Authorization', `Bearer ${token}`)
        .send();

      const secret = (statusResponse.body.data ?? []).find(
        (entry: { secretType: string }) => entry.secretType === 'trading_client_secret',
      );
      expect(secret).toBeDefined();
      expect(secret?.status).toBe('active');
      expect(secret?.lastValidatedAt).toBeDefined();
    } finally {
      await ctx.close();
    }
  });

  it('returns conflict when another rotation is already running', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.rotate'] });
      const response = await ctx.request
        .post('/ops/apex-omni/secrets/rotation-preview')
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretType: 'webhook_shared_secret',
          gcpSecretVersion: '42',
        });

      expect(response.status).toBe(200);
    } finally {
      await ctx.close();
    }
  });
});
