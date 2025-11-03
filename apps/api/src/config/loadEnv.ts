import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const loadEnv = (filename: string) => {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  const baseDir = dirname(fileURLToPath(import.meta.url));
  const envPath = join(baseDir, '../../', filename);

  try {
    process.loadEnvFile(envPath);
  } catch {
    // Ignore missing env files; optional override.
  }
};

loadEnv('.env.local');
loadEnv('.env');
