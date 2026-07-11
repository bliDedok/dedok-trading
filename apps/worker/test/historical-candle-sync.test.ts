import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  CandleInput,
  SupportedSymbol,
} from '@dedok/shared';

import type {
  AssetDefinition,
} from '../src/market-data/assets.js';
import type {
  BinanceKline,
  BinanceKlineRequest,
} from '../src/market-data/binance-types.js';
import type {
  MarketDataRepositoryContract,
  StoreCandlesResult,
} from '../src/repositories/market-data-repository.js';
import {
  HistoricalCandleSync,
  type BinanceKlineClient,
  type HistoricalSyncLogger,
} from '../src/services/historical-candle-sync.js';

const closedKline: BinanceKline = [
  1_700_000_000_000,
  '100',
  '110',
  '90',
  '105',
  '12.5',
  1_700_003_599_999,
  '1312.5',
  100,
  '6.1',
  '640.5',
  '0',
];

function createLogger(): HistoricalSyncLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createClient(
  implementation: (
    request: BinanceKlineRequest,
  ) => Promise<BinanceKline[]>,
): BinanceKlineClient {
  return {
    getKlines: vi.fn(implementation),
  };
}

function createRepository(): {
  repository: MarketDataRepositoryContract;
  upsertAssets: ReturnType<typeof vi.fn>;
  storeClosedCandles:
    ReturnType<typeof vi.fn>;
} {
  const upsertAssets = vi.fn(
    async (
      assets: readonly AssetDefinition[],
    ) => {
      const result =
        new Map<SupportedSymbol, string>();

      for (const asset of assets) {
        result.set(
          asset.symbol,
          `asset-${asset.symbol}`,
        );
      }

      return result;
    },
  );

  const storeClosedCandles = vi.fn(
    async (
      _assetId: string,
      _symbol: SupportedSymbol,
      candles: readonly CandleInput[],
    ): Promise<StoreCandlesResult> => ({
      received: candles.length,
      inserted: candles.length,
      skipped: 0,
    }),
  );

  return {
    repository: {
      upsertAssets,
      storeClosedCandles,
    },
    upsertAssets,
    storeClosedCandles,
  };
}

describe('HistoricalCandleSync', () => {
  it('synchronizes selected symbols and timeframes', async () => {
    const client = createClient(
      async () => [closedKline],
    );

    const {
      repository,
      upsertAssets,
      storeClosedCandles,
    } = createRepository();

    const sync =
      new HistoricalCandleSync(
        client,
        repository,
        createLogger(),
        {
          candleLimit: 300,
          symbols: ['BTCUSDT'],
          timeframes: ['1h', '4h'],
        },
      );

    const result = await sync.run();

    expect(upsertAssets).toHaveBeenCalledOnce();
    expect(client.getKlines).toHaveBeenCalledTimes(
      2,
    );
    expect(
      storeClosedCandles,
    ).toHaveBeenCalledTimes(2);

    expect(result.items).toHaveLength(2);
    expect(result.totalInserted).toBe(2);
    expect(result.totalSkipped).toBe(0);
    expect(result.failures).toBe(0);
    expect(sync.isRunning()).toBe(false);
  });

  it('continues when one timeframe fails', async () => {
    const client = createClient(
      async (request) => {
        if (request.interval === '1h') {
          throw new Error(
            'Temporary Binance failure',
          );
        }

        return [closedKline];
      },
    );

    const { repository } =
      createRepository();

    const logger = createLogger();

    const sync =
      new HistoricalCandleSync(
        client,
        repository,
        logger,
        {
          candleLimit: 100,
          symbols: ['BTCUSDT'],
          timeframes: ['1h', '4h'],
        },
      );

    const result = await sync.run();

    expect(result.items).toHaveLength(1);
    expect(result.failures).toBe(1);
    expect(result.totalInserted).toBe(1);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('does not persist a forming candle', async () => {
    const futureKline: BinanceKline = [
      Date.now(),
      '100',
      '110',
      '90',
      '105',
      '12.5',
      Date.now() + 3_600_000,
      '1312.5',
      100,
      '6.1',
      '640.5',
      '0',
    ];

    const client = createClient(
      async () => [futureKline],
    );

    const {
      repository,
      storeClosedCandles,
    } = createRepository();

    const sync =
      new HistoricalCandleSync(
        client,
        repository,
        createLogger(),
        {
          candleLimit: 100,
          symbols: ['BTCUSDT'],
          timeframes: ['1h'],
        },
      );

    const result = await sync.run();

    expect(
      storeClosedCandles,
    ).toHaveBeenCalledWith(
      'asset-BTCUSDT',
      'BTCUSDT',
      [],
    );

    expect(result.totalInserted).toBe(0);
  });

  it('rejects overlapping synchronization runs', async () => {
    let resolveRequest:
      | ((value: BinanceKline[]) => void)
      | undefined;

    const client = createClient(
      () =>
        new Promise<BinanceKline[]>(
          (resolve) => {
            resolveRequest = resolve;
          },
        ),
    );

    const { repository } =
      createRepository();

    const sync =
      new HistoricalCandleSync(
        client,
        repository,
        createLogger(),
        {
          candleLimit: 100,
          symbols: ['BTCUSDT'],
          timeframes: ['1h'],
        },
      );

    const firstRun = sync.run();

    await Promise.resolve();

    await expect(
      sync.run(),
    ).rejects.toThrow(
      'Historical candle synchronization is already running',
    );

    resolveRequest?.([closedKline]);

    await firstRun;

    expect(sync.isRunning()).toBe(false);
  });

  it('rejects an invalid candle limit', () => {
    const client = createClient(
      async () => [],
    );

    const { repository } =
      createRepository();

    expect(
      () =>
        new HistoricalCandleSync(
          client,
          repository,
          createLogger(),
          {
            candleLimit: 1001,
          },
        ),
    ).toThrow(
      'Historical candle limit must be an integer between 1 and 1000',
    );
  });
});