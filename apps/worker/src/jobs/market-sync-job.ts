import type {
  HistoricalSyncResult,
} from '../services/historical-candle-sync.js';

export interface HistoricalSyncRunner {
  run(): Promise<HistoricalSyncResult>;
}

export interface MarketSyncJobLogger {
  info(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  warn(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  error(
    bindings: Record<string, unknown>,
    message: string,
  ): void;
}

export interface MarketSyncJobOptions {
  intervalMs: number;
}

export class MarketSyncJob {
  private timeout:
    | NodeJS.Timeout
    | undefined;

  private started = false;

  private executing = false;

  public constructor(
    private readonly sync:
      HistoricalSyncRunner,
    private readonly logger:
      MarketSyncJobLogger,
    private readonly options:
      MarketSyncJobOptions,
  ) {
    if (
      !Number.isInteger(options.intervalMs) ||
      options.intervalMs < 60_000
    ) {
      throw new RangeError(
        'Market sync interval must be an integer of at least 60000ms',
      );
    }
  }

  public isStarted(): boolean {
    return this.started;
  }

  public isExecuting(): boolean {
    return this.executing;
  }

  public async start(): Promise<void> {
    if (this.started) {
      this.logger.warn(
        {},
        'Market sync job is already started',
      );

      return;
    }

    this.started = true;

    this.logger.info(
      {
        intervalMs: this.options.intervalMs,
      },
      'Market sync job started',
    );

    await this.execute();

    if (this.started) {
      this.scheduleNextRun();
    }
  }

  public stop(): void {
    this.started = false;

    if (this.timeout !== undefined) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    this.logger.info(
      {},
      'Market sync job stopped',
    );
  }

  public async triggerNow(): Promise<boolean> {
    if (this.executing) {
      this.logger.warn(
        {},
        'Market sync execution skipped because another execution is active',
      );

      return false;
    }

    await this.execute();

    return true;
  }

  private scheduleNextRun(): void {
    if (!this.started) {
      return;
    }

    this.timeout = setTimeout(() => {
      void this.handleScheduledRun();
    }, this.options.intervalMs);
  }

  private async handleScheduledRun(): Promise<void> {
    this.timeout = undefined;

    await this.execute();

    if (this.started) {
      this.scheduleNextRun();
    }
  }

  private async execute(): Promise<void> {
    if (this.executing) {
      this.logger.warn(
        {},
        'Market sync execution skipped because another execution is active',
      );

      return;
    }

    this.executing = true;

    const executionStartedAt = Date.now();

    try {
      const result = await this.sync.run();

      this.logger.info(
        {
          durationMs:
            Date.now() - executionStartedAt,
          startedAt:
            result.startedAt.toISOString(),
          completedAt:
            result.completedAt.toISOString(),
          itemCount: result.items.length,
          totalReceived:
            result.totalReceived,
          totalInserted:
            result.totalInserted,
          totalSkipped:
            result.totalSkipped,
          failures: result.failures,
        },
        'Market sync execution completed',
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          durationMs:
            Date.now() - executionStartedAt,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : {
                  message:
                    'Unknown market sync job error',
                },
        },
        'Market sync execution failed',
      );
    } finally {
      this.executing = false;
    }
  }
}