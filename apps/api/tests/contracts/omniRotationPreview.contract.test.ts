import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

const path = '/ops/apex-omni/secrets/rotation-preview';

describe('POST /ops/apex-omni/secrets/rotation-preview (contract)', () => {
  it('validates payload and returns success metadata', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.rotate'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretType: 'trading_api_key',
          gcpSecretVersion: '5',
          dryRunWebhookUrl: 'https://example.com/test',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          validated: expect.any(Boolean),
          latencyMs: expect.any(Number),
        }),
      );
    } finally {
      await ctx.close();
    }
  });

  it('returns 409 when rotation already in progress for the same secret type', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.rotate'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretType: 'trading_api_key',
          gcpSecretVersion: '5',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'ROTATION_IN_PROGRESS',
        }),
      });
    } finally {
      await ctx.close();
    }
  });
});
