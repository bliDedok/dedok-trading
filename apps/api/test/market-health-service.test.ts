import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  MarketQueryRepositoryContract,
} from '../src/repositories/market-query-repository.js';
import {
  MarketHealthService,
} from '../src/services/market-health-service.js';

function createRepository(
  latest: Awaited<
    ReturnType<
      MarketQueryRepositoryContract[
        'listLatestCandleTimes'
      ]
    >
  >,
): MarketQueryRepositoryContract {
  return {
    listAssets: vi.fn(),
    listCandles: vi.fn(),
    getLatestCandle: vi.fn(),
    listLatestCandleTimes:
      vi.fn().mockResolvedValue(latest),
  };
}

describe('MarketHealthService', () => {
  it('reports down when no market data exists', async () => {
    const service =
      new MarketHealthService(
        createRepository([]),
      );

    const result =
      await service.evaluate(
        new Date(
          '2026-07-12T03:00:00.000Z',
        ),
      );

    expect(result).toMatchObject({
      status: 'DOWN',
      expectedMarkets: 12,
      availableMarkets: 0,
      staleMarkets: 0,
    });
  });

  it('reports degraded when markets are missing', async () => {
    const service =
      new MarketHealthService(
        createRepository([
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            closeTime:
              '2026-07-12T02:59:59.999Z',
          },
        ]),
      );

    const result =
      await service.evaluate(
        new Date(
          '2026-07-12T03:00:00.000Z',
        ),
      );

    expect(result.status).toBe(
      'DEGRADED',
    );

    expect(result.availableMarkets).toBe(
      1,
    );

    expect(result.staleMarkets).toBe(0);
  });

  it('marks old candle data as stale', async () => {
    const service =
      new MarketHealthService(
        createRepository([
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            closeTime:
              '2026-07-12T01:00:00.000Z',
          },
        ]),
      );

    const result =
      await service.evaluate(
        new Date(
          '2026-07-12T03:00:00.000Z',
        ),
      );

    expect(result.status).toBe(
      'DEGRADED',
    );

    expect(result.staleMarkets).toBe(1);

    expect(result.markets[0]?.stale).toBe(
      true,
    );
  });
});