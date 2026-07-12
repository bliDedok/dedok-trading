import type {
  PrismaClient,
} from '@dedok/database';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  MarketQueryRepository,
} from '../src/repositories/market-query-repository.js';

function decimal(value: string) {
  return {
    toString: () => value,
  };
}

function createCandle(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'candle-1',
    symbol: 'BTCUSDT',
    timeframe: 'M15',
    source: 'BINANCE',
    openTime: new Date(
      '2026-07-12T00:30:00.000Z',
    ),
    closeTime: new Date(
      '2026-07-12T00:44:59.999Z',
    ),
    open: decimal('118000.000000000000'),
    high: decimal('118500.000000000000'),
    low: decimal('117900.000000000000'),
    close: decimal('118300.000000000000'),
    volume: decimal('123.450000000000000000'),
    quoteVolume: decimal(
      '14500000.000000000000000000',
    ),
    tradeCount: 1234,
    takerBuyBaseVolume: decimal(
      '60.000000000000000000',
    ),
    takerBuyQuoteVolume: decimal(
      '7100000.000000000000000000',
    ),
    isClosed: true,
    receivedAt: new Date(
      '2026-07-12T00:45:00.220Z',
    ),
    ...overrides,
  };
}

function createPrismaMock() {
  const assetFindMany = vi.fn();
  const candleFindMany = vi.fn();
  const candleFindFirst = vi.fn();
  const candleGroupBy = vi.fn();

  const prisma = {
    asset: {
      findMany: assetFindMany,
    },
    candle: {
      findMany: candleFindMany,
      findFirst: candleFindFirst,
      groupBy: candleGroupBy,
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    assetFindMany,
    candleFindMany,
    candleFindFirst,
    candleGroupBy,
  };
}

describe(
  'MarketQueryRepository',
  () => {
    it('lists assets with latest candle time', async () => {
      const {
        prisma,
        assetFindMany,
      } = createPrismaMock();

      assetFindMany.mockResolvedValue([
        {
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          candles: [
            {
              closeTime: new Date(
                '2026-07-12T00:44:59.999Z',
              ),
            },
          ],
        },
        {
          symbol: 'ETHUSDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          candles: [],
        },
      ]);

      const repository =
        new MarketQueryRepository(
          prisma,
        );

      await expect(
        repository.listAssets(),
      ).resolves.toEqual([
        {
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          latestCandleTime:
            '2026-07-12T00:44:59.999Z',
        },
        {
          symbol: 'ETHUSDT',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          latestCandleTime: null,
        },
      ]);
    });

    it('lists candles in descending order', async () => {
      const {
        prisma,
        candleFindMany,
      } = createPrismaMock();

      candleFindMany.mockResolvedValue([
        createCandle(),
      ]);

      const repository =
        new MarketQueryRepository(
          prisma,
        );

      const result =
        await repository.listCandles({
          symbol: 'BTCUSDT',
          timeframe: '15m',
          limit: 100,
        });

      expect(
        candleFindMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            symbol: 'BTCUSDT',
            timeframe: 'M15',
            isClosed: true,
          },
          orderBy: {
            openTime: 'desc',
          },
          take: 101,
        }),
      );

      expect(result).toMatchObject({
        pagination: {
          limit: 100,
          hasMore: false,
          nextBefore: null,
        },
      });

      expect(result.data[0]).toEqual({
        id: 'candle-1',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        source: 'BINANCE',
        openTime:
          '2026-07-12T00:30:00.000Z',
        closeTime:
          '2026-07-12T00:44:59.999Z',
        open: '118000.000000000000',
        high: '118500.000000000000',
        low: '117900.000000000000',
        close: '118300.000000000000',
        volume:
          '123.450000000000000000',
        quoteVolume:
          '14500000.000000000000000000',
        tradeCount: 1234,
        takerBuyBaseVolume:
          '60.000000000000000000',
        takerBuyQuoteVolume:
          '7100000.000000000000000000',
        isClosed: true,
        receivedAt:
          '2026-07-12T00:45:00.220Z',
      });
    });

    it('applies the before cursor', async () => {
      const {
        prisma,
        candleFindMany,
      } = createPrismaMock();

      candleFindMany.mockResolvedValue([]);

      const repository =
        new MarketQueryRepository(
          prisma,
        );

      await repository.listCandles({
        symbol: 'ETHUSDT',
        timeframe: '1h',
        limit: 50,
        before:
          '2026-07-12T00:00:00.000Z',
      });

      expect(
        candleFindMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            symbol: 'ETHUSDT',
            timeframe: 'H1',
            isClosed: true,
            openTime: {
              lt: new Date(
                '2026-07-12T00:00:00.000Z',
              ),
            },
          },
          take: 51,
        }),
      );
    });

    it('returns a next cursor when more rows exist', async () => {
      const {
        prisma,
        candleFindMany,
      } = createPrismaMock();

      candleFindMany.mockResolvedValue([
        createCandle({
          id: 'candle-2',
          openTime: new Date(
            '2026-07-12T00:30:00.000Z',
          ),
        }),
        createCandle({
          id: 'candle-1',
          openTime: new Date(
            '2026-07-12T00:15:00.000Z',
          ),
          closeTime: new Date(
            '2026-07-12T00:29:59.999Z',
          ),
        }),
        createCandle({
          id: 'older-extra-row',
          openTime: new Date(
            '2026-07-12T00:00:00.000Z',
          ),
        }),
      ]);

      const repository =
        new MarketQueryRepository(
          prisma,
        );

      const result =
        await repository.listCandles({
          symbol: 'BTCUSDT',
          timeframe: '15m',
          limit: 2,
        });

      expect(result.data).toHaveLength(2);

      expect(result.pagination).toEqual({
        limit: 2,
        hasMore: true,
        nextBefore:
          '2026-07-12T00:15:00.000Z',
      });
    });

    it('rejects an unexpected asset symbol from storage', async () => {
      const {
        prisma,
        assetFindMany,
      } = createPrismaMock();

      assetFindMany.mockResolvedValue([
        {
          symbol: 'DOGEUSDT',
          baseAsset: 'DOGE',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          candles: [],
        },
      ]);

      const repository =
        new MarketQueryRepository(
          prisma,
        );

      await expect(
        repository.listAssets(),
      ).rejects.toThrow();
    });

    it('returns the latest closed candle', async () => {
        const {
            prisma,
            candleFindFirst,
        } = createPrismaMock();

        candleFindFirst.mockResolvedValue(
            createCandle(),
        );

        const repository =
            new MarketQueryRepository(prisma);

        const result =
            await repository.getLatestCandle(
            'BTCUSDT',
            '15m',
            );

        expect(
            candleFindFirst,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
            where: {
                symbol: 'BTCUSDT',
                timeframe: 'M15',
                isClosed: true,
            },
            orderBy: {
                openTime: 'desc',
            },
            }),
        );

        expect(result).toMatchObject({
            symbol: 'BTCUSDT',
            timeframe: '15m',
            close:
            '118300.000000000000',
            isClosed: true,
        });
    });

    it('returns null when no latest candle exists', async () => {
    const {
        prisma,
        candleFindFirst,
    } = createPrismaMock();

    candleFindFirst.mockResolvedValue(
        null,
    );

    const repository =
        new MarketQueryRepository(prisma);

    await expect(
        repository.getLatestCandle(
        'SOLUSDT',
        '4h',
        ),
    ).resolves.toBeNull();
    });

    it('lists latest close times by market', async () => {
    const {
        prisma,
        candleGroupBy,
    } = createPrismaMock();

    candleGroupBy.mockResolvedValue([
        {
        symbol: 'BTCUSDT',
        timeframe: 'M15',
        _max: {
            closeTime: new Date(
            '2026-07-12T02:59:59.999Z',
            ),
        },
        },
        {
        symbol: 'ETHUSDT',
        timeframe: 'H1',
        _max: {
            closeTime: new Date(
            '2026-07-12T02:59:59.999Z',
            ),
        },
        },
        {
        symbol: 'SOLUSDT',
        timeframe: 'D1',
        _max: {
            closeTime: null,
        },
        },
    ]);

    const repository =
        new MarketQueryRepository(prisma);

    await expect(
        repository.listLatestCandleTimes(),
    ).resolves.toEqual([
        {
        symbol: 'BTCUSDT',
        timeframe: '15m',
        closeTime:
            '2026-07-12T02:59:59.999Z',
        },
        {
        symbol: 'ETHUSDT',
        timeframe: '1h',
        closeTime:
            '2026-07-12T02:59:59.999Z',
        },
    ]);
    });
  },
);