import type {
  IndicatorSeries,
} from './contracts.js';
import {
  assertFiniteSeries,
  assertValidPeriod,
} from './validation.js';

export function calculateRsi(
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

  if (values.length <= period) {
    return {
      values: result,
      warmupPeriod: period,
    };
  }

  let gainSum = 0;
  let lossSum = 0;

  for (
    let index = 1;
    index <= period;
    index += 1
  ) {
    const change =
      values[index]! -
      values[index - 1]!;

    if (change > 0) {
      gainSum += change;
    } else {
      lossSum += Math.abs(change);
    }
  }

  let averageGain =
    gainSum / period;

  let averageLoss =
    lossSum / period;

  result[period] = toRsi(
    averageGain,
    averageLoss,
  );

  for (
    let index = period + 1;
    index < values.length;
    index += 1
  ) {
    const change =
      values[index]! -
      values[index - 1]!;

    const gain =
      change > 0 ? change : 0;

    const loss =
      change < 0
        ? Math.abs(change)
        : 0;

    averageGain =
      (
        averageGain *
          (period - 1) +
        gain
      ) /
      period;

    averageLoss =
      (
        averageLoss *
          (period - 1) +
        loss
      ) /
      period;

    result[index] = toRsi(
      averageGain,
      averageLoss,
    );
  }

  return {
    values: result,
    warmupPeriod: period,
  };
}

function toRsi(
  averageGain: number,
  averageLoss: number,
): number {
  if (
    averageGain === 0 &&
    averageLoss === 0
  ) {
    return 50;
  }

  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  const relativeStrength =
    averageGain / averageLoss;

  return (
    100 -
    100 / (1 + relativeStrength)
  );
}