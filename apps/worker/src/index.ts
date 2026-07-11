import {
  disconnectPrisma,
  getPrismaClient,
} from '@dedok/database';
import { pino } from 'pino';

import {
  parseWorkerEnv,
  WorkerEnvironmentError,
} from './config/env.js';
import { MarketSyncJob } from './jobs/market-sync-job.js';
import { BinanceRestClient } from './market-data/binance-rest-client.js';
import { MarketDataRepository } from './repositories/market-data-repository.js';
import { HistoricalCandleSync } from './services/historical-candle-sync.js';

async function main(): Promise<void> {
  const environment = parseWorkerEnv(
    process.env,
  );

  const logger = pino({
    name: 'dedok-worker',
    level: environment.LOG_LEVEL,
    base: {
      service: 'worker',
      environment:
        environment.NODE_ENV,
    },
    redact: {
      paths: [
        'authorization',
        'cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        'DATABASE_URL',
        'databaseUrl',
        '*.apiKey',
        '*.apiSecret',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  });

  if (!environment.WORKER_ENABLED) {
    logger.warn(
      {},
      'Worker is disabled by configuration',
    );

    return;
  }

  const prisma = getPrismaClient(
    environment.DATABASE_URL,
  );

  const repository =
    new MarketDataRepository(prisma);

  const binanceClient =
    new BinanceRestClient({
      baseUrl:
        environment.BINANCE_REST_BASE_URL,
      timeoutMs:
        environment.BINANCE_REQUEST_TIMEOUT_MS,
      maxRetries:
        environment.BINANCE_MAX_RETRIES,
    });

  const historicalSync =
    new HistoricalCandleSync(
      binanceClient,
      repository,
      logger,
      {
        candleLimit:
          environment
            .MARKET_INITIAL_CANDLE_LIMIT,
      },
    );

  const marketSyncJob =
    new MarketSyncJob(
      historicalSync,
      logger,
      {
        intervalMs:
          environment.MARKET_SYNC_INTERVAL_MS,
      },
    );

  const heartbeat = setInterval(() => {
    logger.info(
      {
        status: 'HEALTHY',
        marketSyncEnabled:
          environment.MARKET_SYNC_ENABLED,
        marketSyncStarted:
          marketSyncJob.isStarted(),
        marketSyncExecuting:
          marketSyncJob.isExecuting(),
        emergencyStop:
          environment
            .EMERGENCY_STOP_DEFAULT,
      },
      'Worker heartbeat',
    );
  }, environment.WORKER_HEARTBEAT_INTERVAL_MS);

  let shuttingDown = false;

  const shutdown = async (
    signal: NodeJS.Signals,
  ): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    logger.info(
      {
        signal,
      },
      'Worker shutdown started',
    );

    clearInterval(heartbeat);
    marketSyncJob.stop();

    try {
      await disconnectPrisma();

      logger.info(
        {
          signal,
        },
        'Worker shutdown completed',
      );

      process.exitCode = 0;
    } catch (error: unknown) {
      logger.error(
        {
          signal,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : {
                  message:
                    'Unknown shutdown error',
                },
        },
        'Worker shutdown failed',
      );

      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  logger.info(
    {
      marketSyncEnabled:
        environment.MARKET_SYNC_ENABLED,
      candleLimit:
        environment
          .MARKET_INITIAL_CANDLE_LIMIT,
      marketSyncIntervalMs:
        environment.MARKET_SYNC_INTERVAL_MS,
      emergencyStop:
        environment
          .EMERGENCY_STOP_DEFAULT,
    },
    'Worker initialized',
  );

  if (
    environment.MARKET_SYNC_ENABLED
  ) {
    await marketSyncJob.start();
  } else {
    logger.warn(
      {},
      'Historical market synchronization is disabled',
    );
  }
}

main().catch(async (error: unknown) => {
  const fallbackLogger = pino({
    name: 'dedok-worker-bootstrap',
    level: 'error',
  });

  if (
    error instanceof
    WorkerEnvironmentError
  ) {
    fallbackLogger.error(
      {
        issues: error.issues,
      },
      error.message,
    );
  } else {
    fallbackLogger.error(
      {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : {
                message:
                  'Unknown worker bootstrap error',
              },
      },
      'Worker failed to start',
    );
  }

  try {
    await disconnectPrisma();
  } finally {
    process.exitCode = 1;
  }
});