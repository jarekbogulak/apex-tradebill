/// <reference types="jest" />

import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

const path = '/internal/apex-omni/secrets/cache/refresh';

describe('POST /internal/apex-omni/secrets/cache/refresh (contract)', () => {
  it('schedules refresh for all secret types when no payload provided', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['svc.omni.secrets.cache'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(202);
      expect(response.body).toEqual(
        expect.objectContaining({
          requestId: expect.any(String),
          refreshedSecretTypes: expect.arrayContaining([
            'trading_api_key',
            'trading_client_secret',
            'trading_api_passphrase',
            'webhook_shared_secret',
          ]),
        }),
      );
    } finally {
      await ctx.close();
    }
  });

  it('targets a single secret type when provided in the payload', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['svc.omni.secrets.cache'] });
      const response = await ctx.request
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretType: 'webhook_shared_secret',
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual(
        expect.objectContaining({
          refreshedSecretTypes: ['webhook_shared_secret'],
        }),
      );
    } finally {
      await ctx.close();
    }
  });
});
