import type {
  PrismaClient,
} from '@dedok/database';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  IndicatorQueryRepository,
} from '../src/repositories/indicator-query-repository.js';

function decimal(
  value: string,
) {
  return {
    toString: () => value,
  };
}

describe(
  'IndicatorQueryRepository',
  () => {
    const candleFindMany =
      vi.fn();

    const prisma = {
      candle: {
        findMany:
          candleFindMany,
      },
    } as unknown as PrismaClient;

    const repository =
      new IndicatorQueryRepository(
        prisma,
      );

    beforeEach(() => {
      candleFindMany.mockReset();
    });

    it('loads closed candles and returns chronological order', async () => {
      const newerOpenTime =
        new Date(
          '2026-07-12T04:30:00.000Z',
        );

      const olderOpenTime =
        new Date(
          '2026-07-12T04:15:00.000Z',
        );

      candleFindMany.mockResolvedValue([
        {
          openTime: newerOpenTime,
          closeTime: new Date(
            '2026-07-12T04:44:59.999Z',
          ),
          open: decimal('64000'),
          high: decimal('64100'),
          low: decimal('63950'),
          close: decimal('64050'),
          volume: decimal('120.5'),
        },
        {
          openTime: olderOpenTime,
          closeTime: new Date(
            '2026-07-12T04:29:59.999Z',
          ),
          open: decimal('63900'),
          high: decimal('64020'),
          low: decimal('63850'),
          close: decimal('64000'),
          volume: decimal('100.25'),
        },
      ]);

      const candles =
        await repository.listClosedCandles(
          'BTCUSDT',
          '15m',
          300,
        );

      expect(
        candleFindMany,
      ).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          timeframe: 'M15',
          isClosed: true,
        },
        orderBy: {
          openTime: 'desc',
        },
        take: 300,
        select: {
          openTime: true,
          closeTime: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

      expect(candles).toEqual([
        {
          openTime:
            olderOpenTime,
          closeTime:
            new Date(
              '2026-07-12T04:29:59.999Z',
            ),
          open: 63900,
          high: 64020,
          low: 63850,
          close: 64000,
          volume: 100.25,
        },
        {
          openTime:
            newerOpenTime,
          closeTime:
            new Date(
              '2026-07-12T04:44:59.999Z',
            ),
          open: 64000,
          high: 64100,
          low: 63950,
          close: 64050,
          volume: 120.5,
        },
      ]);
    });

    it('returns an empty array when no candles exist', async () => {
      candleFindMany.mockResolvedValue(
        [],
      );

      await expect(
        repository.listClosedCandles(
          'SOLUSDT',
          '4h',
          200,
        ),
      ).resolves.toEqual([]);
    });

    it('rejects a non-finite database value', async () => {
      candleFindMany.mockResolvedValue([
        {
          openTime: new Date(
            '2026-07-12T04:30:00.000Z',
          ),
          closeTime: new Date(
            '2026-07-12T04:44:59.999Z',
          ),
          open: decimal('invalid'),
          high: decimal('64100'),
          low: decimal('63950'),
          close: decimal('64050'),
          volume: decimal('120.5'),
        },
      ]);

      await expect(
        repository.listClosedCandles(
          'BTCUSDT',
          '15m',
          300,
        ),
      ).rejects.toThrow(
        'Invalid candle open value: invalid',
      );
    });
  },
);