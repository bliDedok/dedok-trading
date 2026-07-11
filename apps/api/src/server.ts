import { disconnectPrisma, getPrismaClient } from '@dedok/database';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const prisma = getPrismaClient(env.DATABASE_URL);
const app = await buildApp({ env, prisma });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'Graceful shutdown started');
  await app.close();
  await disconnectPrisma();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error: unknown) {
  app.log.fatal({ err: error }, 'API startup failed');
  await disconnectPrisma();
  process.exit(1);
}
