import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateAtr,
  calculateRsi,
  calculateTrueRange,
} from '../src/index.js';
import {
  closePrices,
  createIndicatorCandles,
} from './fixtures.js';

describe('calculateRsi', () => {
  it('calculates Wilder RSI', () => {
    const result = calculateRsi(
      closePrices,
      5,
    );

    expect(
      result.warmupPeriod,
    ).toBe(5);

    expect(
      result.values.slice(0, 5),
    ).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);

    expect(
    result.values[5],
    ).toBeCloseTo(
    84.375,
    9,
    );

    expect(
    result.values[19],
    ).toBeCloseTo(
    84.6451297047,
    9,
    );
  });

  it('returns 100 for an all-gain series', () => {
    const result = calculateRsi(
      [1, 2, 3, 4],
      3,
    );

    expect(
      result.values[3],
    ).toBe(100);
  });

  it('returns 0 for an all-loss series', () => {
    const result = calculateRsi(
      [4, 3, 2, 1],
      3,
    );

    expect(
      result.values[3],
    ).toBe(0);
  });

  it('returns 50 for a flat series', () => {
    const result = calculateRsi(
      [5, 5, 5, 5],
      3,
    );

    expect(
      result.values[3],
    ).toBe(50);
  });
});

describe('calculateTrueRange', () => {
  it('calculates candle true ranges', () => {
    const candles =
      createIndicatorCandles();

    const result =
      calculateTrueRange(candles);

    expect(result).toHaveLength(
      candles.length,
    );

    expect(result[0]).toBeCloseTo(
      candles[0]!.high -
        candles[0]!.low,
      10,
    );

    expect(result[1]).toBeCloseTo(
      Math.max(
        candles[1]!.high -
          candles[1]!.low,
        Math.abs(
          candles[1]!.high -
            candles[0]!.close,
        ),
        Math.abs(
          candles[1]!.low -
            candles[0]!.close,
        ),
      ),
      10,
    );
  });
});

describe('calculateAtr', () => {
  it('calculates Wilder ATR', () => {
    const result = calculateAtr(
      createIndicatorCandles(),
      5,
    );

    expect(
      result.warmupPeriod,
    ).toBe(4);

    expect(
      result.values.slice(0, 4),
    ).toEqual([
      null,
      null,
      null,
      null,
    ]);

    expect(
    result.values[4],
    ).toBeCloseTo(
    0.73,
    10,
    );

    expect(
    result.values[19],
    ).toBeCloseTo(
    0.9057735781,
    9,
    );
  });

  it('returns null values when history is insufficient', () => {
    const candles =
      createIndicatorCandles().slice(
        0,
        3,
      );

    const result = calculateAtr(
      candles,
      5,
    );

    expect(result.values).toEqual([
      null,
      null,
      null,
    ]);
  });
});