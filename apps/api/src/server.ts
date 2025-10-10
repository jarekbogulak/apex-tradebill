import Fastify, { type FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info'
    }
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
};

const start = async () => {
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const server = buildServer();

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return entry === fileURLToPath(import.meta.url);
};

if (isDirectRun()) {
  void start();
}
