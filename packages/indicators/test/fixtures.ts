import type {
  IndicatorCandle,
} from '../src/contracts.js';

export const closePrices = [
  44,
  44.15,
  43.9,
  44.35,
  44.8,
  45.1,
  44.75,
  45.4,
  45.9,
  46.2,
  45.85,
  46.5,
  46.9,
  47.25,
  47,
  47.6,
  48.1,
  47.8,
  48.45,
  48.9,
] as const;

export function createIndicatorCandles():
  IndicatorCandle[] {
  const startTime = Date.UTC(
    2026,
    0,
    1,
    0,
    0,
    0,
  );

  return closePrices.map(
    (close, index) => {
      const open =
        index === 0
          ? close - 0.1
          : closePrices[index - 1] ??
            close;

      const openTime = new Date(
        startTime +
          index * 15 * 60 * 1_000,
      );

      const closeTime = new Date(
        openTime.getTime() +
          15 * 60 * 1_000 -
          1,
      );

      return {
        openTime,
        closeTime,
        open,
        high:
          Math.max(open, close) + 0.25,
        low:
          Math.min(open, close) - 0.2,
        close,
        volume: 100 + index * 5,
      };
    },
  );
}