import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('GET /ops/apex-omni/secrets/status (contract)', () => {
  const path = '/ops/apex-omni/secrets/status';

  it('rejects requests without operator authorization', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const response = await ctx.request.get(path);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: expect.objectContaining({
          code: 'UNAUTHENTICATED',
        }),
      });
    } finally {
      await ctx.close();
    }
  });

  it('returns the predefined secret catalog snapshot for authorized operators', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({
        scope: ['ops.omni.secrets.read'],
      });
      const response = await ctx.request
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .set('x-device-id', 'ops-console');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.updatedAt).toBeDefined();

      const secretTypes = (response.body.data ?? []).map((entry: { secretType: string }) => {
        return entry.secretType;
      });
      expect(secretTypes).toEqual(
        expect.arrayContaining(['trading_api_key', 'trading_client_secret', 'webhook_shared_secret']),
      );

      (response.body.data ?? []).forEach((entry: Record<string, unknown>) => {
        expect(entry).toEqual(
          expect.objectContaining({
            secretType: expect.any(String),
            status: expect.any(String),
            cacheSource: expect.any(String),
          }),
        );
      });
    } finally {
      await ctx.close();
    }
  });
});
