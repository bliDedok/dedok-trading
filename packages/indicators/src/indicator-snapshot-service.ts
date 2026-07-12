import type {
  IndicatorCandle,
  IndicatorSnapshot,
} from './contracts.js';
import {
  calculateAtr,
} from './atr.js';
import {
  calculateBollingerBands,
} from './bollinger-bands.js';
import {
  calculateEma,
} from './ema.js';
import {
  calculateMacd,
} from './macd.js';
import {
  calculateRsi,
} from './rsi.js';
import {
  extractPriceSeries,
  getLatestValue,
} from './series.js';
import {
  calculateSma,
} from './sma.js';
import {
  assertValidCandles,
  assertValidPeriod,
} from './validation.js';

export interface IndicatorSnapshotConfig {
  smaPeriods: readonly number[];
  emaPeriods: readonly number[];
  rsiPeriods: readonly number[];
  atrPeriods: readonly number[];
  macd: {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
  };
  bollingerBands: {
    period: number;
    standardDeviations: number;
  };
}

export const DEFAULT_INDICATOR_SNAPSHOT_CONFIG:
  IndicatorSnapshotConfig = {
    smaPeriods: [20, 50, 200],
    emaPeriods: [9, 21, 50],
    rsiPeriods: [14],
    atrPeriods: [14],
    macd: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    },
    bollingerBands: {
      period: 20,
      standardDeviations: 2,
    },
  };

export type IndicatorClock =
  () => Date;

export class IndicatorSnapshotService {
  public constructor(
    private readonly config:
      IndicatorSnapshotConfig =
        DEFAULT_INDICATOR_SNAPSHOT_CONFIG,
    private readonly clock:
      IndicatorClock =
        () => new Date(),
  ) {
    assertValidSnapshotConfig(config);
  }

  public calculate(
    candles:
      readonly IndicatorCandle[],
  ): IndicatorSnapshot | null {
    assertValidCandles(candles);

    const latestCandle =
      candles[candles.length - 1];

    if (latestCandle === undefined) {
      return null;
    }

    const closePrices =
      extractPriceSeries(
        candles,
        'close',
      );

    const sma =
      calculatePeriodRecord(
        this.config.smaPeriods,
        (period) =>
          getLatestValue(
            calculateSma(
              closePrices,
              period,
            ).values,
          ),
      );

    const ema =
      calculatePeriodRecord(
        this.config.emaPeriods,
        (period) =>
          getLatestValue(
            calculateEma(
              closePrices,
              period,
            ).values,
          ),
      );

    const rsi =
      calculatePeriodRecord(
        this.config.rsiPeriods,
        (period) =>
          getLatestValue(
            calculateRsi(
              closePrices,
              period,
            ).values,
          ),
      );

    const atr =
      calculatePeriodRecord(
        this.config.atrPeriods,
        (period) =>
          getLatestValue(
            calculateAtr(
              candles,
              period,
            ).values,
          ),
      );

    const macdSeries =
      calculateMacd(
        closePrices,
        this.config.macd,
      );

    const latestMacd =
      macdSeries.values[
        macdSeries.values.length - 1
      ] ?? {
        macd: null,
        signal: null,
        histogram: null,
      };

    const bollingerSeries =
      calculateBollingerBands(
        closePrices,
        this.config
          .bollingerBands,
      );

    const latestBollinger =
      bollingerSeries.values[
        bollingerSeries.values.length -
          1
      ] ?? {
        middle: null,
        upper: null,
        lower: null,
      };

    return {
      calculatedAt:
        this.clock(),
      candleOpenTime:
        latestCandle.openTime,
      candleCloseTime:
        latestCandle.closeTime,
      close:
        latestCandle.close,
      sma,
      ema,
      rsi,
      atr,
      macd: {
        macd:
          latestMacd.macd,
        signal:
          latestMacd.signal,
        histogram:
          latestMacd.histogram,
      },
      bollingerBands: {
        middle:
          latestBollinger.middle,
        upper:
          latestBollinger.upper,
        lower:
          latestBollinger.lower,
      },
    };
  }
}

function calculatePeriodRecord(
  periods: readonly number[],
  calculate: (
    period: number,
  ) => number | null,
): Record<
  string,
  number | null
> {
  return Object.fromEntries(
    periods.map((period) => [
      String(period),
      calculate(period),
    ]),
  );
}

function assertValidSnapshotConfig(
  config:
    IndicatorSnapshotConfig,
): void {
  const periodGroups = [
    config.smaPeriods,
    config.emaPeriods,
    config.rsiPeriods,
    config.atrPeriods,
  ];

  for (
    const periods of periodGroups
  ) {
    for (const period of periods) {
      assertValidPeriod(period);
    }

    if (
      new Set(periods).size !==
      periods.length
    ) {
      throw new RangeError(
        'Indicator snapshot periods must not contain duplicates',
      );
    }
  }

  assertValidPeriod(
    config.macd.fastPeriod,
  );
  assertValidPeriod(
    config.macd.slowPeriod,
  );
  assertValidPeriod(
    config.macd.signalPeriod,
  );
  assertValidPeriod(
    config.bollingerBands.period,
  );

  if (
    config.macd.fastPeriod >=
    config.macd.slowPeriod
  ) {
    throw new RangeError(
      'MACD fast period must be less than slow period',
    );
  }

  if (
    !Number.isFinite(
      config.bollingerBands
        .standardDeviations,
    ) ||
    config.bollingerBands
      .standardDeviations <= 0
  ) {
    throw new RangeError(
      'Bollinger Bands standard deviations must be greater than zero',
    );
  }
}