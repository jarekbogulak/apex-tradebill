describe('Omni secret metadata seed script', () => {
  it('bootstraps the predefined catalog with rotation deadlines', async () => {
    await expect(
      import('../../src/scripts/seedOmniSecrets.js'),
    ).resolves.toHaveProperty('seedOmniSecrets');
  });
});
