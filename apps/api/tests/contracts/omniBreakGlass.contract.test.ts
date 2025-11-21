import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

const path = '/ops/apex-omni/secrets/break-glass';

describe('POST /ops/apex-omni/secrets/break-glass (contract)', () => {
  const buildPayload = (overrides: Record<string, unknown> = {}) => ({
    secretType: 'trading_api_key',
    ciphertext: 'base64-encrypted-secret',
    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    ...overrides,
  });

  it('accepts valid payloads and returns 201 with expiry echo', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.breakglass'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(buildPayload());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        secretType: 'trading_api_key',
        expiresAt: expect.any(String),
      });
    } finally {
      await ctx.close();
    }
  });

  it('rejects payloads whose TTL exceeds 30 minutes', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.breakglass'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(
          buildPayload({
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          }),
        );

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: 'INVALID_BREAK_GLASS_TTL',
      });
    } finally {
      await ctx.close();
    }
  });
});
