import {
  IndicatorSnapshotService,
  type IndicatorCandle,
} from '@dedok/indicators';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  IndicatorQueryRepositoryContract,
} from '../src/repositories/indicator-query-repository.js';
import {
  LatestIndicatorService,
} from '../src/services/latest-indicator-service.js';

function createCandles():
  IndicatorCandle[] {
  const start =
    Date.UTC(
      2026,
      0,
      1,
      0,
      0,
      0,
    );

  return Array.from(
    {
      length: 40,
    },
    (_, index) => {
      const close =
        100 + index;

      return {
        openTime:
          new Date(
            start +
              index *
                15 *
                60 *
                1000,
          ),
        closeTime:
          new Date(
            start +
              (index + 1) *
                15 *
                60 *
                1000 -
              1,
          ),
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000 + index,
      };
    },
  );
}

describe(
  'LatestIndicatorService',
  () => {
    it('returns the latest snapshot', async () => {
      const candles =
        createCandles();

      const repository = {
        listClosedCandles:
          vi.fn()
            .mockResolvedValue(
              candles,
            ),
      } satisfies
        IndicatorQueryRepositoryContract;

      const calculatedAt =
        new Date(
          '2026-07-12T06:00:00.000Z',
        );

      const snapshotService =
        new IndicatorSnapshotService(
          {
            smaPeriods: [5],
            emaPeriods: [5],
            rsiPeriods: [5],
            atrPeriods: [5],
            macd: {
              fastPeriod: 3,
              slowPeriod: 5,
              signalPeriod: 3,
            },
            bollingerBands: {
              period: 5,
              standardDeviations: 2,
            },
          },
          () => calculatedAt,
        );

      const service =
        new LatestIndicatorService(
          repository,
          snapshotService,
        );

      const result =
        await service.getLatest(
          'BTCUSDT',
          '15m',
          300,
        );

      expect(
        repository
          .listClosedCandles,
      ).toHaveBeenCalledWith(
        'BTCUSDT',
        '15m',
        300,
      );

      expect(result).not.toBeNull();

      expect(
        result?.candleCount,
      ).toBe(40);

      expect(
        result?.snapshot
          .calculatedAt,
      ).toEqual(calculatedAt);

      expect(
        result?.snapshot.close,
      ).toBe(139);
    });

    it('returns null when no candles exist', async () => {
      const repository = {
        listClosedCandles:
          vi.fn()
            .mockResolvedValue(
              [],
            ),
      } satisfies
        IndicatorQueryRepositoryContract;

      const service =
        new LatestIndicatorService(
          repository,
        );

      await expect(
        service.getLatest(
          'ETHUSDT',
          '1h',
          300,
        ),
      ).resolves.toBeNull();
    });
  },
);