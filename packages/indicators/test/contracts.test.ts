import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  IndicatorInputError,
  assertFiniteSeries,
  assertValidCandles,
  assertValidPeriod,
  createEmptySeries,
  extractPriceSeries,
  getLatestValue,
} from '../src/index.js';
import {
  closePrices,
  createIndicatorCandles,
} from './fixtures.js';

describe('indicator validation', () => {
  it('accepts a positive integer period', () => {
    expect(() =>
      assertValidPeriod(14),
    ).not.toThrow();
  });

  it('rejects an invalid period', () => {
    expect(() =>
      assertValidPeriod(0),
    ).toThrow(IndicatorInputError);

    expect(() =>
      assertValidPeriod(2.5),
    ).toThrow(IndicatorInputError);
  });

  it('rejects non-finite series values', () => {
    expect(() =>
      assertFiniteSeries([
        1,
        Number.NaN,
        3,
      ]),
    ).toThrow(
      'Indicator series contains a non-finite value at index 1',
    );
  });

  it('accepts deterministic candles', () => {
    expect(() =>
      assertValidCandles(
        createIndicatorCandles(),
      ),
    ).not.toThrow();
  });

  it('rejects an invalid OHLC candle', () => {
    const candles =
      createIndicatorCandles();

    candles[0] = {
      ...candles[0]!,
      high: 40,
    };

    expect(() =>
      assertValidCandles(candles),
    ).toThrow(
      'Candle contains an invalid OHLC relationship at index 0',
    );
  });
});

describe('indicator series helpers', () => {
  it('extracts close prices', () => {
    const values =
      extractPriceSeries(
        createIndicatorCandles(),
      );

    expect(values).toEqual([
      ...closePrices,
    ]);
  });

  it('extracts derived price sources', () => {
    const candle =
      createIndicatorCandles()[0]!;

    const hl2 = extractPriceSeries(
      [candle],
      'hl2',
    );

    const hlc3 = extractPriceSeries(
      [candle],
      'hlc3',
    );

    expect(hl2[0]).toBeCloseTo(
      (candle.high + candle.low) / 2,
      10,
    );

    expect(hlc3[0]).toBeCloseTo(
      (
        candle.high +
        candle.low +
        candle.close
      ) / 3,
      10,
    );
  });

  it('creates null warm-up values', () => {
    expect(
      createEmptySeries(4),
    ).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('gets the latest series value', () => {
    expect(
      getLatestValue([
        null,
        10,
        12,
      ]),
    ).toBe(12);

    expect(
      getLatestValue([]),
    ).toBeNull();
  });
});