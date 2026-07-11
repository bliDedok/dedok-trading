import { pino } from 'pino';
import { z } from 'zod';
import { disconnectPrisma, getPrismaClient } from '@dedok/database';

const schema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url(),
  WORKER_ENABLED: z.string().default('true').transform((value) => value === 'true'),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid worker environment: ${z.prettifyError(parsed.error)}`);
const env = parsed.data;
const logger = pino({ level: env.LOG_LEVEL, redact: ['*.apiKey', '*.apiSecret', '*.token'] });
const prisma = getPrismaClient(env.DATABASE_URL);
let timer: NodeJS.Timeout | undefined;

async function heartbeat(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info({ component: 'worker', status: 'HEALTHY' }, 'Worker heartbeat');
  } catch (error: unknown) {
    logger.error({ err: error, component: 'worker', status: 'DOWN' }, 'Worker heartbeat failed');
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Worker graceful shutdown started');
  if (timer) clearInterval(timer);
  await disconnectPrisma();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

if (!env.WORKER_ENABLED) {
  logger.warn('Worker disabled by configuration');
} else {
  await heartbeat();
  timer = setInterval(() => void heartbeat(), env.WORKER_HEARTBEAT_INTERVAL_MS);
}
