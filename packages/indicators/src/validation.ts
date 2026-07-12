import type {
  IndicatorCandle,
} from './contracts.js';
import {
  IndicatorInputError,
} from './errors.js';

export function assertValidPeriod(
  period: number,
): void {
  if (
    !Number.isInteger(period) ||
    period < 1
  ) {
    throw new IndicatorInputError(
      'Indicator period must be a positive integer',
    );
  }
}

export function assertFiniteSeries(
  values: readonly number[],
): void {
  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new IndicatorInputError(
        `Indicator series contains a non-finite value at index ${index}`,
      );
    }
  });
}

export function assertValidCandles(
  candles: readonly IndicatorCandle[],
): void {
  candles.forEach((candle, index) => {
    const numericValues = [
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
    ];

    if (
      numericValues.some(
        (value) =>
          !Number.isFinite(value),
      )
    ) {
      throw new IndicatorInputError(
        `Candle contains a non-finite numeric value at index ${index}`,
      );
    }

    if (
      Number.isNaN(
        candle.openTime.getTime(),
      ) ||
      Number.isNaN(
        candle.closeTime.getTime(),
      )
    ) {
      throw new IndicatorInputError(
        `Candle contains an invalid timestamp at index ${index}`,
      );
    }

    if (
      candle.closeTime.getTime() <=
      candle.openTime.getTime()
    ) {
      throw new IndicatorInputError(
        `Candle close time must be after open time at index ${index}`,
      );
    }

    if (
      candle.high <
        Math.max(
          candle.open,
          candle.close,
        ) ||
      candle.low >
        Math.min(
          candle.open,
          candle.close,
        ) ||
      candle.high < candle.low
    ) {
      throw new IndicatorInputError(
        `Candle contains an invalid OHLC relationship at index ${index}`,
      );
    }

    if (candle.volume < 0) {
      throw new IndicatorInputError(
        `Candle volume must not be negative at index ${index}`,
      );
    }
  });
}