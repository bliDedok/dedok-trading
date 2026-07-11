import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  MarketSyncJob,
  type HistoricalSyncRunner,
  type MarketSyncJobLogger,
} from '../src/jobs/market-sync-job.js';

function createResult() {
  const now = new Date();

  return {
    startedAt: now,
    completedAt: now,
    items: [],
    totalReceived: 0,
    totalInserted: 0,
    totalSkipped: 0,
    failures: 0,
  };
}

function createLogger(): MarketSyncJobLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MarketSyncJob', () => {
  it('runs immediately when started', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(createResult());

    const runner: HistoricalSyncRunner = {
      run,
    };

    const job = new MarketSyncJob(
      runner,
      createLogger(),
      {
        intervalMs: 60_000,
      },
    );

    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(job.isStarted()).toBe(true);
    expect(job.isExecuting()).toBe(false);

    job.stop();

    expect(job.isStarted()).toBe(false);
  });

  it('does not start twice', async () => {
    const run = vi
      .fn()
      .mockResolvedValue(createResult());

    const logger = createLogger();

    const job = new MarketSyncJob(
      {
        run,
      },
      logger,
      {
        intervalMs: 60_000,
      },
    );

    await job.start();
    await job.start();

    expect(run).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      {},
      'Market sync job is already started',
    );

    job.stop();
  });

  it('runs again after the configured interval', async () => {
    vi.useFakeTimers();

    const run = vi
      .fn()
      .mockResolvedValue(createResult());

    const job = new MarketSyncJob(
      {
        run,
      },
      createLogger(),
      {
        intervalMs: 60_000,
      },
    );

    await job.start();

    expect(run).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(
      60_000,
    );

    expect(run).toHaveBeenCalledTimes(2);

    job.stop();
  });

  it('logs execution failures without crashing', async () => {
    const run = vi
      .fn()
      .mockRejectedValue(
        new Error('Database unavailable'),
      );

    const logger = createLogger();

    const job = new MarketSyncJob(
      {
        run,
      },
      logger,
      {
        intervalMs: 60_000,
      },
    );

    await expect(
      job.start(),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledOnce();
    expect(job.isExecuting()).toBe(false);

    job.stop();
  });

  it('rejects an interval below one minute', () => {
    expect(
      () =>
        new MarketSyncJob(
          {
            run: vi
              .fn()
              .mockResolvedValue(
                createResult(),
              ),
          },
          createLogger(),
          {
            intervalMs: 59_999,
          },
        ),
    ).toThrow(
      'Market sync interval must be an integer of at least 60000ms',
    );
  });
});