if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-secret-change-me';
}

if (!process.env.APEX_ALLOW_IN_MEMORY_DB) {
  process.env.APEX_ALLOW_IN_MEMORY_DB = 'true';
}

if (!process.env.APEX_ALLOW_IN_MEMORY_MARKET_DATA) {
  process.env.APEX_ALLOW_IN_MEMORY_MARKET_DATA = 'true';
}
