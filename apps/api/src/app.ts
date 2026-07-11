import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@dedok/database';
import type { ApiEnv } from './config/env.js';
import { healthRoutes } from './routes/health.js';

interface BuildAppOptions { env: ApiEnv; prisma: PrismaClient; version?: string }

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: options.env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    requestIdHeader: 'x-request-id',
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: options.env.CORS_ORIGINS.split(',').map((value) => value.trim()),
    credentials: true,
  });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(healthRoutes, { prisma: options.prisma, version: options.version ?? '0.1.0' });
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled request error');
    void reply.code(500).send({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error', requestId: request.id } });
  });
  return app;
}
