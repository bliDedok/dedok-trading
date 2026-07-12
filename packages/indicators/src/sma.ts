import type {
  IndicatorSeries,
} from './contracts.js';
import {
  assertFiniteSeries,
  assertValidPeriod,
} from './validation.js';

export function calculateSma(
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

  let rollingSum = 0;

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    rollingSum += values[index]!;

    if (index >= period) {
      rollingSum -=
        values[index - period]!;
    }

    if (index >= period - 1) {
      result[index] =
        rollingSum / period;
    }
  }

  return {
    values: result,
    warmupPeriod: period - 1,
  };
}