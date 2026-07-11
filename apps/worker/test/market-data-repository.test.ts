import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CandleInput } from '@dedok/shared';

import {
  MarketDataValidationError,
  assertClosedCandles,
  buildCandleCreateManyData,
} from '../src/repositories/market-data-repository.js';

function createCandle(
  overrides: Partial<CandleInput> = {},
): CandleInput {
  return {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    openTime: new Date(
      '2026-01-01T00:00:00.000Z',
    ),
    closeTime: new Date(
      '2026-01-01T00:59:59.999Z',
    ),
    open: '100',
    high: '110',
    low: '90',
    close: '105',
    volume: '12.5',
    quoteVolume: '1312.5',
    tradeCount: 100,
    takerBuyBaseVolume: '6.1',
    takerBuyQuoteVolume: '640.5',
    isClosed: true,
    receivedAt: new Date(
      '2026-01-01T01:00:01.000Z',
    ),
    ...overrides,
  };
}

describe('market data repository validation', () => {
  it('accepts valid closed candles', () => {
    expect(() =>
      assertClosedCandles('BTCUSDT', [
        createCandle(),
      ]),
    ).not.toThrow();
  });

  it('rejects an open candle', () => {
    expect(() =>
      assertClosedCandles('BTCUSDT', [
        createCandle({
          isClosed: false,
        }),
      ]),
    ).toThrow(MarketDataValidationError);
  });

  it('rejects a candle for another symbol', () => {
    expect(() =>
      assertClosedCandles('BTCUSDT', [
        createCandle({
          symbol: 'ETHUSDT',
        }),
      ]),
    ).toThrow(
      'Candle symbol ETHUSDT does not match expected symbol BTCUSDT',
    );
  });

  it('rejects a close time before the open time', () => {
    expect(() =>
      assertClosedCandles('BTCUSDT', [
        createCandle({
          closeTime: new Date(
            '2025-12-31T23:59:59.999Z',
          ),
        }),
      ]),
    ).toThrow(
      'Candle closeTime must be after openTime',
    );
  });

  it('builds Prisma createMany data', () => {
    const data =
      buildCandleCreateManyData(
        'asset-btc',
        'BTCUSDT',
        [createCandle()],
      );

    expect(data).toHaveLength(1);

    expect(data[0]).toMatchObject({
      assetId: 'asset-btc',
      symbol: 'BTCUSDT',
      timeframe: 'H1',
      source: 'BINANCE',
      open: '100',
      high: '110',
      low: '90',
      close: '105',
      isClosed: true,
    });
  });

  it('maps all supported database timeframes', () => {
    const data =
      buildCandleCreateManyData(
        'asset-btc',
        'BTCUSDT',
        [
          createCandle({
            timeframe: '15m',
          }),
          createCandle({
            timeframe: '1h',
          }),
          createCandle({
            timeframe: '4h',
          }),
          createCandle({
            timeframe: '1d',
          }),
        ],
      );

    expect(
      data.map((item) => item.timeframe),
    ).toEqual([
      'M15',
      'H1',
      'H4',
      'D1',
    ]);
  });
});