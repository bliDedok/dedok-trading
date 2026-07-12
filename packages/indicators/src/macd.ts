import type {
  MacdValue,
} from './contracts.js';
import {
  calculateEma,
} from './ema.js';
import {
  assertFiniteSeries,
  assertValidPeriod,
} from './validation.js';

export interface MacdSeries {
  values: MacdValue[];
  warmupPeriod: number;
}

export interface MacdOptions {
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export function calculateMacd(
  values: readonly number[],
  options: MacdOptions = {},
): MacdSeries {
  const fastPeriod =
    options.fastPeriod ?? 12;

  const slowPeriod =
    options.slowPeriod ?? 26;

  const signalPeriod =
    options.signalPeriod ?? 9;

  assertValidPeriod(fastPeriod);
  assertValidPeriod(slowPeriod);
  assertValidPeriod(signalPeriod);
  assertFiniteSeries(values);

  if (fastPeriod >= slowPeriod) {
    throw new RangeError(
      'MACD fast period must be less than slow period',
    );
  }

  const fastEma = calculateEma(
    values,
    fastPeriod,
  ).values;

  const slowEma = calculateEma(
    values,
    slowPeriod,
  ).values;

  const result: MacdValue[] =
    values.map(() => ({
      macd: null,
      signal: null,
      histogram: null,
    }));

  const macdValues: number[] = [];
  const macdIndexes: number[] = [];

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const fast = fastEma[index];
    const slow = slowEma[index];

    if (
      fast == null ||
      slow == null
    ) {
      continue;
    }

    const macd = fast - slow;

    result[index] = {
      macd,
      signal: null,
      histogram: null,
    };

    macdValues.push(macd);
    macdIndexes.push(index);
  }

  const signalValues = calculateEma(
    macdValues,
    signalPeriod,
  ).values;

  for (
    let index = 0;
    index < signalValues.length;
    index += 1
  ) {
    const signal =
      signalValues[index];

    if (signal == null) {
      continue;
    }

    const targetIndex =
      macdIndexes[index];

    if (targetIndex === undefined) {
      continue;
    }

    const macd =
      result[targetIndex]?.macd;

    if (macd == null) {
      continue;
    }

    result[targetIndex] = {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  return {
    values: result,
    warmupPeriod:
      slowPeriod +
      signalPeriod -
      2,
  };
}