import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  IndicatorSnapshotService,
  calculateAtr,
  calculateBollingerBands,
  calculateEma,
  calculateMacd,
  calculateRsi,
  calculateSma,
  extractPriceSeries,
  getLatestValue,
  type IndicatorSnapshotConfig,
} from '../src/index.js';
import {
  createIndicatorCandles,
} from './fixtures.js';

const testConfig:
  IndicatorSnapshotConfig = {
    smaPeriods: [3, 5],
    emaPeriods: [3, 5],
    rsiPeriods: [5],
    atrPeriods: [5],
    macd: {
      fastPeriod: 3,
      slowPeriod: 5,
      signalPeriod: 3,
    },
    bollingerBands: {
      period: 5,
      standardDeviations: 2,
    },
  };

describe(
  'IndicatorSnapshotService',
  () => {
    it('returns null for an empty candle list', () => {
      const service =
        new IndicatorSnapshotService(
          testConfig,
        );

      expect(
        service.calculate([]),
      ).toBeNull();
    });

    it('creates a deterministic latest snapshot', () => {
      const calculatedAt =
        new Date(
          '2026-07-12T05:00:00.000Z',
        );

      const service =
        new IndicatorSnapshotService(
          testConfig,
          () => calculatedAt,
        );

      const candles =
        createIndicatorCandles();

      const snapshot =
        service.calculate(candles);

      const latestCandle =
        candles[
          candles.length - 1
        ]!;

      expect(snapshot).not.toBeNull();

      expect(
        snapshot!.calculatedAt,
      ).toEqual(calculatedAt);

      expect(
        snapshot!.candleOpenTime,
      ).toEqual(
        latestCandle.openTime,
      );

      expect(
        snapshot!.candleCloseTime,
      ).toEqual(
        latestCandle.closeTime,
      );

      expect(
        snapshot!.close,
      ).toBe(latestCandle.close);
    });

    it('matches standalone indicator calculations', () => {
      const candles =
        createIndicatorCandles();

      const closePrices =
        extractPriceSeries(candles);

      const service =
        new IndicatorSnapshotService(
          testConfig,
        );

      const snapshot =
        service.calculate(candles)!;

      expect(
        snapshot.sma['3'],
      ).toBe(
        getLatestValue(
          calculateSma(
            closePrices,
            3,
          ).values,
        ),
      );

      expect(
        snapshot.sma['5'],
      ).toBe(
        getLatestValue(
          calculateSma(
            closePrices,
            5,
          ).values,
        ),
      );

      expect(
        snapshot.ema['5'],
      ).toBe(
        getLatestValue(
          calculateEma(
            closePrices,
            5,
          ).values,
        ),
      );

      expect(
        snapshot.rsi['5'],
      ).toBe(
        getLatestValue(
          calculateRsi(
            closePrices,
            5,
          ).values,
        ),
      );

      expect(
        snapshot.atr['5'],
      ).toBe(
        getLatestValue(
          calculateAtr(
            candles,
            5,
          ).values,
        ),
      );

      const macd =
        calculateMacd(
          closePrices,
          testConfig.macd,
        ).values.at(-1)!;

      expect(snapshot.macd).toEqual(
        macd,
      );

      const bollingerBands =
        calculateBollingerBands(
          closePrices,
          testConfig
            .bollingerBands,
        ).values.at(-1)!;

      expect(
        snapshot.bollingerBands,
      ).toEqual(
        bollingerBands,
      );
    });

    it('returns null indicator values when history is insufficient', () => {
      const service =
        new IndicatorSnapshotService(
          {
            smaPeriods: [10],
            emaPeriods: [10],
            rsiPeriods: [10],
            atrPeriods: [10],
            macd: {
              fastPeriod: 5,
              slowPeriod: 10,
              signalPeriod: 5,
            },
            bollingerBands: {
              period: 10,
              standardDeviations: 2,
            },
          },
        );

      const snapshot =
        service.calculate(
          createIndicatorCandles().slice(
            0,
            3,
          ),
        )!;

      expect(
        snapshot.sma['10'],
      ).toBeNull();

      expect(
        snapshot.ema['10'],
      ).toBeNull();

      expect(
        snapshot.rsi['10'],
      ).toBeNull();

      expect(
        snapshot.atr['10'],
      ).toBeNull();

      expect(snapshot.macd).toEqual({
        macd: null,
        signal: null,
        histogram: null,
      });

      expect(
        snapshot.bollingerBands,
      ).toEqual({
        middle: null,
        upper: null,
        lower: null,
      });
    });

    it('rejects duplicate periods', () => {
      expect(
        () =>
          new IndicatorSnapshotService(
            {
              ...testConfig,
              smaPeriods: [5, 5],
            },
          ),
      ).toThrow(
        'Indicator snapshot periods must not contain duplicates',
      );
    });

    it('rejects invalid MACD configuration', () => {
      expect(
        () =>
          new IndicatorSnapshotService(
            {
              ...testConfig,
              macd: {
                fastPeriod: 5,
                slowPeriod: 5,
                signalPeriod: 3,
              },
            },
          ),
      ).toThrow(
        'MACD fast period must be less than slow period',
      );
    });
  },
);