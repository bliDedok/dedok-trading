import { z } from 'zod';

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  LOG_LEVEL: z
    .enum([
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ])
    .default('info'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .refine(
      (value) =>
        value.startsWith('postgresql://') ||
        value.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string',
    ),

    WORKER_ENABLED: booleanStringSchema.default(true),

  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(10_000),

  MARKET_SYNC_ENABLED:
  booleanStringSchema.default(true),

  MARKET_SYNC_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .max(86_400_000)
    .default(300_000),

  MARKET_INITIAL_CANDLE_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(300),

  BINANCE_REST_BASE_URL: z
    .string()
    .url()
    .default('https://api.binance.com'),

      BINANCE_WS_ENABLED:
    booleanStringSchema.default(true),

  BINANCE_WS_BASE_URL: z
    .string()
    .url()
    .default(
      'wss://stream.binance.com:9443',
    ),

  BINANCE_WS_RECONNECT_BASE_DELAY_MS:
    z.coerce
      .number()
      .int()
      .min(100)
      .max(60_000)
      .default(1_000),

  BINANCE_WS_RECONNECT_MAX_DELAY_MS:
    z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(30_000),

  BINANCE_WS_HEARTBEAT_INTERVAL_MS:
    z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(30_000),

  MARKET_STALE_AFTER_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(86_400_000)
    .default(900_000),

  BINANCE_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(10_000),

  BINANCE_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(10)
    .default(3),

  EMERGENCY_STOP_DEFAULT:
    booleanStringSchema.default(true),
});

export type WorkerEnv = z.infer<
  typeof workerEnvSchema
>;

export class WorkerEnvironmentError extends Error {
  public constructor(
    message: string,
    public readonly issues: readonly string[],
  ) {
    super(message);
    this.name = 'WorkerEnvironmentError';
  }
}

export function parseWorkerEnv(
  environment: NodeJS.ProcessEnv,
): WorkerEnv {
  const result = workerEnvSchema.safeParse(
    environment,
  );

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => {
        const path =
          issue.path.length > 0
            ? issue.path.join('.')
            : 'environment';

        return `${path}: ${issue.message}`;
      },
    );

    throw new WorkerEnvironmentError(
      `Invalid worker environment:\n${issues.join('\n')}`,
      issues,
    );
  }

  return result.data;
}