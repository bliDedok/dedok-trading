import type {
  IndicatorSeries,
} from './contracts.js';
import {
  assertFiniteSeries,
  assertValidPeriod,
} from './validation.js';

export function calculateEma(
  values: readonly number[],
  period: number,
): IndicatorSeries {
  assertValidPeriod(period);
  assertFiniteSeries(values);

  const result: Array<number | null> =
    Array.from(
      {
        length: values.length,
      },
      () => null,
    );

  if (values.length < period) {
    return {
      values: result,
      warmupPeriod: period - 1,
    };
  }

  let seedSum = 0;

  for (
    let index = 0;
    index < period;
    index += 1
  ) {
    seedSum += values[index]!;
  }

  let previousEma =
    seedSum / period;

  result[period - 1] =
    previousEma;

  const multiplier =
    2 / (period + 1);

  for (
    let index = period;
    index < values.length;
    index += 1
  ) {
    previousEma =
      (
        values[index]! -
        previousEma
      ) *
        multiplier +
      previousEma;

    result[index] =
      previousEma;
  }

  return {
    values: result,
    warmupPeriod: period - 1,
  };
}