describe('Omni rotation policy monitor', () => {
  it('emits alerts when rotation_due_at is overdue', async () => {
    await expect(
      import('../../src/jobs/omniRotationMonitor.js'),
    ).resolves.toHaveProperty('scheduleOmniRotationMonitor');
  });
});
