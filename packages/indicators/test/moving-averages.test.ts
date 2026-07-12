import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateEma,
  calculateSma,
} from '../src/index.js';
import {
  closePrices,
} from './fixtures.js';

describe('calculateSma', () => {
  it('calculates a simple moving average', () => {
    const result = calculateSma(
      closePrices,
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
      44.24,
      10,
    );

    expect(
      result.values[5],
    ).toBeCloseTo(
      44.46,
      10,
    );

    expect(
      result.values[19],
    ).toBeCloseTo(
      48.17,
      10,
    );
  });

  it('returns null values when history is insufficient', () => {
    const result = calculateSma(
      [1, 2, 3],
      5,
    );

    expect(result.values).toEqual([
      null,
      null,
      null,
    ]);

    expect(
      result.warmupPeriod,
    ).toBe(4);
  });

  it('supports a period of one', () => {
    const result = calculateSma(
      [1, 2, 3],
      1,
    );

    expect(result.values).toEqual([
      1,
      2,
      3,
    ]);
  });
});

describe('calculateEma', () => {
  it('seeds EMA with the first period SMA', () => {
    const result = calculateEma(
      closePrices,
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
      44.24,
      10,
    );
  });

  it('calculates recursive EMA values', () => {
    const result = calculateEma(
      closePrices,
      5,
    );

    expect(
      result.values[5],
    ).toBeCloseTo(
      44.5266666667,
      10,
    );

    expect(
      result.values[6],
    ).toBeCloseTo(
      44.6011111111,
      10,
    );

    expect(
      result.values[19],
    ).toBeCloseTo(
      48.1858127257,
      9,
    );
  });

  it('returns null values when history is insufficient', () => {
    const result = calculateEma(
      [1, 2, 3],
      5,
    );

    expect(result.values).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('matches the input for period one', () => {
    const result = calculateEma(
      [1, 2, 3],
      1,
    );

    expect(result.values).toEqual([
      1,
      2,
      3,
    ]);
  });
});