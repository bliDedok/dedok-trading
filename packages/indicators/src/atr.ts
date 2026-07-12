import type {
  IndicatorCandle,
  IndicatorSeries,
} from './contracts.js';
import {
  assertValidCandles,
  assertValidPeriod,
} from './validation.js';

export function calculateTrueRange(
  candles: readonly IndicatorCandle[],
): number[] {
  assertValidCandles(candles);

  return candles.map(
    (candle, index) => {
      if (index === 0) {
        return (
          candle.high -
          candle.low
        );
      }

      const previousClose =
        candles[index - 1]!.close;

      return Math.max(
        candle.high - candle.low,
        Math.abs(
          candle.high -
            previousClose,
        ),
        Math.abs(
          candle.low -
            previousClose,
        ),
      );
    },
  );
}

export function calculateAtr(
  candles: readonly IndicatorCandle[],
  period: number,
): IndicatorSeries {
  assertValidPeriod(period);
  assertValidCandles(candles);

  const result: Array<number | null> =
    Array.from(
      {
        length: candles.length,
      },
      () => null,
    );

  if (candles.length < period) {
    return {
      values: result,
      warmupPeriod: period - 1,
    };
  }

  const trueRanges =
    calculateTrueRange(candles);

  let seedSum = 0;

  for (
    let index = 0;
    index < period;
    index += 1
  ) {
    seedSum +=
      trueRanges[index]!;
  }

  let previousAtr =
    seedSum / period;

  result[period - 1] =
    previousAtr;

  for (
    let index = period;
    index < candles.length;
    index += 1
  ) {
    previousAtr =
      (
        previousAtr *
          (period - 1) +
        trueRanges[index]!
      ) /
      period;

    result[index] =
      previousAtr;
  }

  return {
    values: result,
    warmupPeriod: period - 1,
  };
}