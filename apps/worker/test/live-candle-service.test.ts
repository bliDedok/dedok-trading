import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  SupportedSymbol,
} from '@dedok/shared';

import type {
  AssetDefinition,
} from '../src/market-data/assets.js';
import type {
  BinanceWebSocketKlineEvent,
} from '../src/market-data/binance-websocket-types.js';
import type {
  MarketDataRepositoryContract,
} from '../src/repositories/market-data-repository.js';
import {
  LiveCandleService,
} from '../src/services/live-candle-service.js';

function createEvent(
  isClosed = true,
): BinanceWebSocketKlineEvent {
  return {
    eventType: 'kline',
    eventTime: 1_700_003_600_100,
    symbol: 'BTCUSDT',
    stream: 'btcusdt@kline_1h',
    kline: {
      startTime: 1_700_000_000_000,
      closeTime: 1_700_003_599_999,
      symbol: 'BTCUSDT',
      interval: '1h',
      firstTradeId: 100,
      lastTradeId: 200,
      open: '100',
      close: '105',
      high: '110',
      low: '90',
      volume: '12.5',
      tradeCount: 101,
      isClosed,
      quoteVolume: '1312.5',
      takerBuyBaseVolume: '6.1',
      takerBuyQuoteVolume: '640.5',
    },
  };
}

function createRepository() {
  const upsertAssets = vi.fn(
    async (
      assets: readonly AssetDefinition[],
    ) => {
      const values =
        new Map<SupportedSymbol, string>();

      for (const asset of assets) {
        values.set(
          asset.symbol,
          `asset-${asset.symbol}`,
        );
      }

      return values;
    },
  );

  const storeClosedCandles = vi.fn(
    async () => ({
      received: 1,
      inserted: 1,
      skipped: 0,
    }),
  );

  const repository:
    MarketDataRepositoryContract = {
      upsertAssets,
      storeClosedCandles,
    };

  return {
    repository,
    upsertAssets,
    storeClosedCandles,
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('LiveCandleService', () => {
  it('persists a closed candle', async () => {
    const {
      repository,
      storeClosedCandles,
    } = createRepository();

    const service =
      new LiveCandleService(
        repository,
        createLogger(),
      );

    await service.initialize();
    await service.enqueue(
      createEvent(true),
    );

    expect(
      storeClosedCandles,
    ).toHaveBeenCalledOnce();

    expect(
      service.getHealth(),
    ).toMatchObject({
      initialized: true,
      processedEvents: 1,
      insertedCandles: 1,
      ignoredFormingCandles: 0,
      failedEvents: 0,
    });
  });

  it('ignores a forming candle', async () => {
    const {
      repository,
      storeClosedCandles,
    } = createRepository();

    const service =
      new LiveCandleService(
        repository,
        createLogger(),
      );

    await service.initialize();
    await service.enqueue(
      createEvent(false),
    );

    expect(
      storeClosedCandles,
    ).not.toHaveBeenCalled();

    expect(
      service.getHealth(),
    ).toMatchObject({
      processedEvents: 1,
      ignoredFormingCandles: 1,
    });
  });

  it('requires initialization', async () => {
    const { repository } =
      createRepository();

    const service =
      new LiveCandleService(
        repository,
        createLogger(),
      );

    await expect(
      service.enqueue(
        createEvent(true),
      ),
    ).rejects.toThrow(
      'Live candle service has not been initialized',
    );

    await service.waitForIdle();

    expect(
      service.getHealth().failedEvents,
    ).toBe(1);
  });

  it('initializes only once', async () => {
    const {
      repository,
      upsertAssets,
    } = createRepository();

    const service =
      new LiveCandleService(
        repository,
        createLogger(),
      );

    await service.initialize();
    await service.initialize();

    expect(
      upsertAssets,
    ).toHaveBeenCalledOnce();
  });
});