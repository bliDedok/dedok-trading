import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  mapClosedBinanceKline,
  mapClosedBinanceKlines,
} from '../src/market-data/candle-mapper.js';

import type { BinanceKline } from '../src/market-data/binance-types.js';

const closedKline: BinanceKline = [
  1_700_000_000_000,
  '100',
  '110',
  '90',
  '105',
  '12.5',
  1_700_003_599_999,
  '1312.5',
  100,
  '6.1',
  '640.5',
  '0',
];

describe('mapClosedBinanceKline', () => {
  it('maps a closed Binance kline', () => {
    const receivedAt = new Date(
      1_700_003_600_000,
    );

    const candle = mapClosedBinanceKline(
      'BTCUSDT',
      '1h',
      closedKline,
      receivedAt,
    );

    expect(candle).not.toBeNull();
    expect(candle?.symbol).toBe('BTCUSDT');
    expect(candle?.timeframe).toBe('1h');
    expect(candle?.open).toBe('100');
    expect(candle?.high).toBe('110');
    expect(candle?.low).toBe('90');
    expect(candle?.close).toBe('105');
    expect(candle?.volume).toBe('12.5');
    expect(candle?.tradeCount).toBe(100);
    expect(candle?.isClosed).toBe(true);
    expect(candle?.receivedAt).toEqual(
      receivedAt,
    );
  });

  it('ignores a currently forming candle', () => {
    const candle = mapClosedBinanceKline(
      'BTCUSDT',
      '1h',
      closedKline,
      new Date(1_700_003_500_000),
    );

    expect(candle).toBeNull();
  });

  it('treats a candle with equal close and receive time as forming', () => {
    const candle = mapClosedBinanceKline(
      'BTCUSDT',
      '1h',
      closedKline,
      new Date(1_700_003_599_999),
    );

    expect(candle).toBeNull();
  });

  it('rejects an invalid OHLC relationship', () => {
    const invalidKline: BinanceKline = [
      1_700_000_000_000,
      '100',
      '99',
      '90',
      '105',
      '12.5',
      1_700_003_599_999,
      '1312.5',
      100,
      '6.1',
      '640.5',
      '0',
    ];

    expect(() =>
      mapClosedBinanceKline(
        'BTCUSDT',
        '1h',
        invalidKline,
        new Date(1_700_003_600_000),
      ),
    ).toThrow();
  });

  it('maps only closed candles from a list', () => {
    const formingKline: BinanceKline = [
      1_700_003_600_000,
      '105',
      '112',
      '103',
      '108',
      '8.5',
      1_700_007_199_999,
      '918',
      60,
      '4.2',
      '453.6',
      '0',
    ];

    const candles = mapClosedBinanceKlines(
      'BTCUSDT',
      '1h',
      [closedKline, formingKline],
      new Date(1_700_003_700_000),
    );

    expect(candles).toHaveLength(1);
    expect(candles[0]?.openTime).toEqual(
      new Date(1_700_000_000_000),
    );
  });
});