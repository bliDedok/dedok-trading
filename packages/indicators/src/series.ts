import type {
  IndicatorCandle,
  IndicatorValue,
} from './contracts.js';
import {
  assertValidCandles,
} from './validation.js';

export type CandlePriceSource =
  | 'open'
  | 'high'
  | 'low'
  | 'close'
  | 'hl2'
  | 'hlc3'
  | 'ohlc4';

export function extractPriceSeries(
  candles: readonly IndicatorCandle[],
  source: CandlePriceSource = 'close',
): number[] {
  assertValidCandles(candles);

  return candles.map((candle) => {
    switch (source) {
      case 'open':
        return candle.open;

      case 'high':
        return candle.high;

      case 'low':
        return candle.low;

      case 'close':
        return candle.close;

      case 'hl2':
        return (
          candle.high + candle.low
        ) / 2;

      case 'hlc3':
        return (
          candle.high +
          candle.low +
          candle.close
        ) / 3;

      case 'ohlc4':
        return (
          candle.open +
          candle.high +
          candle.low +
          candle.close
        ) / 4;
    }
  });
}

export function createEmptySeries(
  length: number,
): IndicatorValue[] {
  if (
    !Number.isInteger(length) ||
    length < 0
  ) {
    throw new RangeError(
      'Series length must be a non-negative integer',
    );
  }

  return Array.from(
    {
      length,
    },
    () => null,
  );
}

export function getLatestValue(
  values: readonly IndicatorValue[],
): IndicatorValue {
  return values.length === 0
    ? null
    : values[
        values.length - 1
      ] ?? null;
}