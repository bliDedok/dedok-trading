import type {
  BollingerBandValue,
} from './contracts.js';
import {
  assertFiniteSeries,
  assertValidPeriod,
} from './validation.js';

export interface BollingerBandsSeries {
  values: BollingerBandValue[];
  warmupPeriod: number;
}

export interface BollingerBandsOptions {
  period?: number;
  standardDeviations?: number;
}

export function calculateBollingerBands(
  values: readonly number[],
  options: BollingerBandsOptions = {},
): BollingerBandsSeries {
  const period =
    options.period ?? 20;

  const standardDeviations =
    options.standardDeviations ?? 2;

  assertValidPeriod(period);
  assertFiniteSeries(values);

  if (
    !Number.isFinite(
      standardDeviations,
    ) ||
    standardDeviations <= 0
  ) {
    throw new RangeError(
      'Bollinger Bands standard deviations must be greater than zero',
    );
  }

  const result: BollingerBandValue[] =
    values.map(() => ({
      middle: null,
      upper: null,
      lower: null,
    }));

  if (values.length < period) {
    return {
      values: result,
      warmupPeriod: period - 1,
    };
  }

  let rollingSum = 0;
  let rollingSquareSum = 0;

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const current =
      values[index]!;

    rollingSum += current;
    rollingSquareSum +=
      current * current;

    if (index >= period) {
      const removed =
        values[index - period]!;

      rollingSum -= removed;
      rollingSquareSum -=
        removed * removed;
    }

    if (index < period - 1) {
      continue;
    }

    const mean =
      rollingSum / period;

    const variance =
      Math.max(
        0,
        rollingSquareSum /
          period -
          mean * mean,
      );

    const standardDeviation =
      Math.sqrt(variance);

    const offset =
      standardDeviations *
      standardDeviation;

    result[index] = {
      middle: mean,
      upper: mean + offset,
      lower: mean - offset,
    };
  }

  return {
    values: result,
    warmupPeriod: period - 1,
  };
}