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
  buildApp,
} from '../src/app.js';

const env = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  API_HOST: '127.0.0.1',
  API_PORT: 4000,
  DATABASE_URL:
    'postgresql://user:pass@localhost:5432/test',
  CORS_ORIGINS:
    'http://localhost:3000',
} as const;

function decimal(value: string) {
  return {
    toString: () => value,
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
    $queryRaw: vi.fn(),
  } as unknown as PrismaClient;

  return {
    prisma,
    assetFindMany,
    candleFindMany,
    candleFindFirst,
    candleGroupBy,
  };
}

describe('market routes', () => {
  it('returns assets', async () => {
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
    ]);

    const app = await buildApp({
      env,
      prisma,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/assets',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toEqual({
      data: [
        {
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          status: 'ACTIVE',
          latestCandleTime:
            '2026-07-12T00:44:59.999Z',
        },
      ],
    });

    await app.close();
  });

  it('returns a candle page', async () => {
    const {
      prisma,
      candleFindMany,
    } = createPrismaMock();

    candleFindMany.mockResolvedValue([
      {
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
        open: decimal('118000'),
        high: decimal('118500'),
        low: decimal('117900'),
        close: decimal('118300'),
        volume: decimal('123.45'),
        quoteVolume:
          decimal('14500000'),
        tradeCount: 1234,
        takerBuyBaseVolume:
          decimal('60'),
        takerBuyQuoteVolume:
          decimal('7100000'),
        isClosed: true,
        receivedAt: new Date(
          '2026-07-12T00:45:00.220Z',
        ),
      },
    ]);

    const app = await buildApp({
      env,
      prisma,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/candles?symbol=BTCUSDT&timeframe=15m&limit=100',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      data: [
        {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          source: 'BINANCE',
          isClosed: true,
        },
      ],
      pagination: {
        limit: 100,
        hasMore: false,
        nextBefore: null,
      },
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
        take: 101,
      }),
    );

    await app.close();
  });

  it('returns 400 for an unsupported symbol', async () => {
    const { prisma } =
      createPrismaMock();

    const app = await buildApp({
      env,
      prisma,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/candles?symbol=DOGEUSDT&timeframe=15m',
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: {
        code: 'INVALID_QUERY',
        message:
          'Invalid market candle query',
      },
    });

    await app.close();
  });

  it('returns 400 when timeframe is missing', async () => {
    const { prisma } =
      createPrismaMock();

    const app = await buildApp({
      env,
      prisma,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/candles?symbol=BTCUSDT',
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      error: {
        code: 'INVALID_QUERY',
      },
    });

    await app.close();
  });

  it('returns the latest candle', async () => {
    const {
        prisma,
        candleFindFirst,
    } = createPrismaMock();

    candleFindFirst.mockResolvedValue({
        id: 'latest-candle',
        symbol: 'BTCUSDT',
        timeframe: 'M15',
        source: 'BINANCE',
        openTime: new Date(
        '2026-07-12T02:45:00.000Z',
        ),
        closeTime: new Date(
        '2026-07-12T02:59:59.999Z',
        ),
        open: decimal('64080.27'),
        high: decimal('64121.87'),
        low: decimal('64060'),
        close: decimal('64070.39'),
        volume: decimal('335.176'),
        quoteVolume:
        decimal('21477871.2389909'),
        tradeCount: 15232,
        takerBuyBaseVolume:
        decimal('170.89248'),
        takerBuyQuoteVolume:
        decimal('10950123.4716247'),
        isClosed: true,
        receivedAt: new Date(
        '2026-07-12T03:00:00.099Z',
        ),
    });

    const app = await buildApp({
        env,
        prisma,
    });

    const response = await app.inject({
        method: 'GET',
        url: '/api/candles/latest?symbol=BTCUSDT&timeframe=15m',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
        data: {
        id: 'latest-candle',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        close: '64070.39',
        isClosed: true,
        },
    });

    await app.close();
    });

    it('returns 404 when latest candle does not exist', async () => {
    const {
        prisma,
        candleFindFirst,
    } = createPrismaMock();

    candleFindFirst.mockResolvedValue(
        null,
    );

    const app = await buildApp({
        env,
        prisma,
    });

    const response = await app.inject({
        method: 'GET',
        url: '/api/candles/latest?symbol=SOLUSDT&timeframe=4h',
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
        error: {
        code: 'CANDLE_NOT_FOUND',
        },
    });

    await app.close();
    });

    it('returns market health metadata', async () => {
    const {
        prisma,
        candleGroupBy,
    } = createPrismaMock();

    candleGroupBy.mockResolvedValue([
        {
        symbol: 'BTCUSDT',
        timeframe: 'M15',
        _max: {
            closeTime: new Date(),
        },
        },
    ]);

    const app = await buildApp({
        env,
        prisma,
    });

    const response = await app.inject({
        method: 'GET',
        url: '/api/market/health',
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
        status: 'DEGRADED',
        expectedMarkets: 12,
        availableMarkets: 1,
        staleMarkets: 0,
    });

    await app.close();
    });

});