import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@dedok/database';
import type { ApiEnv } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import {
  MarketQueryRepository,
} from './repositories/market-query-repository.js';
import {
  marketRoutes,
} from './routes/market.js';

import {
  IndicatorSnapshotService,
} from '@dedok/indicators';

import {
  IndicatorQueryRepository,
} from './repositories/indicator-query-repository.js';
import {
  indicatorRoutes,
} from './routes/indicators.js';
import {
  LatestIndicatorService,
} from './services/latest-indicator-service.js';
import {
  TechnicalStrategy,
} from '@dedok/strategies';

import {
  signalRoutes,
} from './routes/signals.js';
import {
  LatestSignalService,
} from './services/latest-signal-service.js';

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
  const marketRepository =
  new MarketQueryRepository(
    options.prisma,
  );

  await app.register(marketRoutes, {
    repository: marketRepository,
  });

  const indicatorRepository =
  new IndicatorQueryRepository(
    options.prisma,
  );

  const indicatorSnapshotService =
    new IndicatorSnapshotService();

  const latestIndicatorService =
    new LatestIndicatorService(
      indicatorRepository,
      indicatorSnapshotService,
    );

  await app.register(
    indicatorRoutes,
    {
      service:
        latestIndicatorService,
    },
  );

  const technicalStrategy =
  new TechnicalStrategy();

  const latestSignalService =
    new LatestSignalService(
      latestIndicatorService,
      technicalStrategy,
    );

  await app.register(
    signalRoutes,
    {
      service:
        latestSignalService,
    },
  );

  return app;
}
