import type {
  IndicatorSnapshot,
} from '@dedok/indicators';
import {
  TechnicalStrategy,
} from '@dedok/strategies';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  LatestIndicatorService,
} from '../src/services/latest-indicator-service.js';
import {
  LatestSignalService,
} from '../src/services/latest-signal-service.js';

function createBullishSnapshot():
  IndicatorSnapshot {
  return {
    calculatedAt:
      new Date(
        '2026-07-12T06:00:00.000Z',
      ),
    candleOpenTime:
      new Date(
        '2026-07-12T05:30:00.000Z',
      ),
    candleCloseTime:
      new Date(
        '2026-07-12T05:44:59.999Z',
      ),
    close: 110,
    sma: {
      '20': 105,
      '50': 100,
    },
    ema: {
      '9': 108,
      '21': 103,
    },
    rsi: {
      '14': 62,
    },
    atr: {
      '14': 4,
    },
    macd: {
      macd: 5,
      signal: 3,
      histogram: 2,
    },
    bollingerBands: {
      middle: 105,
      upper: 115,
      lower: 95,
    },
  };
}

describe(
  'LatestSignalService',
  () => {
    it('evaluates the latest indicator snapshot', async () => {
      const snapshot =
        createBullishSnapshot();

      const indicatorService = {
        getLatest:
          vi.fn()
            .mockResolvedValue({
              symbol:
                'BTCUSDT',
              timeframe:
                '15m',
              candleCount: 300,
              snapshot,
            }),
      } as unknown as
        LatestIndicatorService;

      const evaluatedAt =
        new Date(
          '2026-07-12T06:01:00.000Z',
        );

      const strategy =
        new TechnicalStrategy(
          undefined,
          () => evaluatedAt,
        );

      const service =
        new LatestSignalService(
          indicatorService,
          strategy,
        );

      const result =
        await service.getLatest(
          'BTCUSDT',
          '15m',
          300,
        );

      expect(
        indicatorService.getLatest,
      ).toHaveBeenCalledWith(
        'BTCUSDT',
        '15m',
        300,
      );

      expect(result).not.toBeNull();

      expect(
        result?.signal.signal,
      ).toBe('LONG');

      expect(
        result?.signal.confidence,
      ).toBe(100);

      expect(
        result?.signal.evaluatedAt,
      ).toEqual(evaluatedAt);

      expect(
        result?.candleCount,
      ).toBe(300);
    });

    it('returns null when indicator data is unavailable', async () => {
      const indicatorService = {
        getLatest:
          vi.fn()
            .mockResolvedValue(
              null,
            ),
      } as unknown as
        LatestIndicatorService;

      const service =
        new LatestSignalService(
          indicatorService,
        );

      await expect(
        service.getLatest(
          'SOLUSDT',
          '4h',
          300,
        ),
      ).resolves.toBeNull();
    });
  },
);