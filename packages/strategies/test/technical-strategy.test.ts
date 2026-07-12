import type {
  IndicatorSnapshot,
} from '@dedok/indicators';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  StrategyInputError,
  TechnicalStrategy,
} from '../src/index.js';

const calculatedAt =
  new Date(
    '2026-07-12T06:00:00.000Z',
  );

function createSnapshot(
  overrides:
    Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  return {
    calculatedAt,
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
    ...overrides,
  };
}

describe(
  'TechnicalStrategy',
  () => {
    it('returns LONG for aligned bullish conditions', () => {
      const evaluatedAt =
        new Date(
          '2026-07-12T06:01:00.000Z',
        );

      const strategy =
        new TechnicalStrategy(
          undefined,
          () => evaluatedAt,
        );

      const result =
        strategy.evaluate(
          createSnapshot(),
        );

      expect(
        result.signal,
      ).toBe('LONG');

      expect(
        result.bullishScore,
      ).toBe(100);

      expect(
        result.bearishScore,
      ).toBe(0);

      expect(
        result.confidence,
      ).toBe(100);

      expect(
        result.evaluatedAt,
      ).toEqual(evaluatedAt);

      expect(
        result.rules,
      ).toHaveLength(6);
    });

    it('returns SHORT for aligned bearish conditions', () => {
      const strategy =
        new TechnicalStrategy();

      const result =
        strategy.evaluate(
          createSnapshot({
            close: 90,
            sma: {
              '20': 95,
              '50': 100,
            },
            ema: {
              '9': 92,
              '21': 97,
            },
            rsi: {
              '14': 38,
            },
            macd: {
              macd: -5,
              signal: -3,
              histogram: -2,
            },
            bollingerBands: {
              middle: 95,
              upper: 105,
              lower: 85,
            },
          }),
        );

      expect(
        result.signal,
      ).toBe('SHORT');

      expect(
        result.bearishScore,
      ).toBe(100);

      expect(
        result.bullishScore,
      ).toBe(0);

      expect(
        result.confidence,
      ).toBe(100);
    });

    it('returns NEUTRAL when indicators conflict', () => {
      const strategy =
        new TechnicalStrategy();

      const result =
        strategy.evaluate(
          createSnapshot({
            close: 110,
            sma: {
              '20': 95,
              '50': 100,
            },
            ema: {
              '9': 90,
              '21': 100,
            },
            rsi: {
              '14': 50,
            },
            macd: {
              macd: -1,
              signal: 1,
              histogram: -2,
            },
            bollingerBands: {
              middle: 105,
              upper: 115,
              lower: 95,
            },
          }),
        );

      expect(
        result.signal,
      ).toBe('NEUTRAL');

      expect(
        result.bullishScore,
        ).toBe(30);

        expect(
        result.bearishScore,
        ).toBe(55);

        expect(
        result.confidence,
        ).toBe(25);
    });

    it('handles unavailable indicators as neutral rules', () => {
      const strategy =
        new TechnicalStrategy();

      const result =
        strategy.evaluate(
          createSnapshot({
            sma: {
              '20': null,
              '50': null,
            },
            ema: {
              '9': null,
              '21': null,
            },
            rsi: {
              '14': null,
            },
            macd: {
              macd: null,
              signal: null,
              histogram: null,
            },
            bollingerBands: {
              middle: null,
              upper: null,
              lower: null,
            },
          }),
        );

      expect(
        result.signal,
      ).toBe('NEUTRAL');

      expect(
        result.bullishScore,
      ).toBe(0);

      expect(
        result.bearishScore,
      ).toBe(0);

      expect(
        result.confidence,
      ).toBe(0);

      expect(
        result.rules.every(
          (rule) =>
            rule.direction ===
            'NEUTRAL',
        ),
      ).toBe(true);
    });

    it('rejects invalid period ordering', () => {
      expect(
        () =>
          new TechnicalStrategy({
            smaFastPeriod: 50,
            smaSlowPeriod: 20,
            emaFastPeriod: 9,
            emaSlowPeriod: 21,
            rsiPeriod: 14,
            atrPeriod: 14,
            longThreshold: 60,
            shortThreshold: 60,
          }),
      ).toThrow(
        StrategyInputError,
      );
    });
  },
);