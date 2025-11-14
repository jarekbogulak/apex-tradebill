describe('Offline cache quickstart scenario', () => {
  test.skip('retains DeviceCache entries while offline and deduplicates on sync', () => {
    // TODO disable network, execute a trade, and ensure the DeviceCache marks the entry dirty.
    // Re-enable connectivity and verify the sync worker uploads the entry once, marks it clean,
    // and avoids duplicates even after background refresh attempts.
    // (Owner: Codex, target 2025-04-07 – see Quickstart acceptance step 11.)
  });
});
