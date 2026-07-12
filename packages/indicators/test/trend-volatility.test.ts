import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateBollingerBands,
  calculateMacd,
} from '../src/index.js';
import {
  closePrices,
} from './fixtures.js';

describe('calculateMacd', () => {
  it('calculates MACD with custom periods', () => {
    const result = calculateMacd(
      closePrices,
      {
        fastPeriod: 3,
        slowPeriod: 5,
        signalPeriod: 3,
      },
    );

    expect(
      result.warmupPeriod,
    ).toBe(6);

    expect(
      result.values
        .slice(0, 4)
        .every(
          (value) =>
            value.macd === null &&
            value.signal === null &&
            value.histogram === null,
        ),
    ).toBe(true);

    expect(
        result.values[4]!.macd,
    ).toBeCloseTo(
    0.2516666667,
    9,
    );

    expect(
  result.values[4]!.macd,
    ).toBeCloseTo(
    0.2516666667,
    9,
    );

    expect(
    result.values[19]!.macd,
    ).toBeCloseTo(
    0.312523812,
    9,
    );

    expect(
    result.values[19]!.signal,
    ).toBeCloseTo(
    0.2867677445,
    9,
    );

    expect(
    result.values[19]!.histogram,
    ).toBeCloseTo(
    0.0257560675,
    9,
    );
  });

  it('rejects invalid period ordering', () => {
    expect(() =>
      calculateMacd(
        closePrices,
        {
          fastPeriod: 5,
          slowPeriod: 5,
          signalPeriod: 3,
        },
      ),
    ).toThrow(
      'MACD fast period must be less than slow period',
    );
  });

  it('returns null signal values when history is insufficient', () => {
    const result = calculateMacd(
      [1, 2, 3, 4, 5],
      {
        fastPeriod: 2,
        slowPeriod: 4,
        signalPeriod: 4,
      },
    );

    expect(
      result.values.every(
        (value) =>
          value.signal === null &&
          value.histogram === null,
      ),
    ).toBe(true);
  });
});

describe('calculateBollingerBands', () => {
  it('calculates population standard deviation bands', () => {
    const result =
      calculateBollingerBands(
        closePrices,
        {
          period: 5,
          standardDeviations: 2,
        },
      );

    expect(
      result.warmupPeriod,
    ).toBe(4);

    expect(
      result.values
        .slice(0, 4)
        .every(
          (value) =>
            value.middle === null &&
            value.upper === null &&
            value.lower === null,
        ),
    ).toBe(true);

    expect(
      result.values[4]!.middle,
    ).toBeCloseTo(
      44.24,
      10,
    );

    expect(
    result.values[4]!.upper,
    ).toBeCloseTo(
    44.8768673331,
    9,
    );

    expect(
    result.values[4]!.lower,
    ).toBeCloseTo(
    43.6031326669,
    9,
    );

    expect(
      result.values[19]!.middle,
    ).toBeCloseTo(
      48.17,
      10,
    );
  });

  it('returns null values when history is insufficient', () => {
    const result =
      calculateBollingerBands(
        [1, 2, 3],
        {
          period: 5,
        },
      );

    expect(result.values).toEqual([
      {
        middle: null,
        upper: null,
        lower: null,
      },
      {
        middle: null,
        upper: null,
        lower: null,
      },
      {
        middle: null,
        upper: null,
        lower: null,
      },
    ]);
  });

  it('rejects invalid standard deviation multipliers', () => {
    expect(() =>
      calculateBollingerBands(
        closePrices,
        {
          period: 5,
          standardDeviations: 0,
        },
      ),
    ).toThrow(
      'Bollinger Bands standard deviations must be greater than zero',
    );
  });
});