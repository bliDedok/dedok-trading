import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  mapClosedWebSocketKline,
} from '../src/market-data/binance-websocket-candle-mapper.js';
import type {
  BinanceWebSocketKlineEvent,
} from '../src/market-data/binance-websocket-types.js';

function createEvent(
  isClosed: boolean,
): BinanceWebSocketKlineEvent {
  return {
    eventType: 'kline',
    eventTime: 1_700_003_600_100,
    symbol: 'BTCUSDT',
    stream: 'btcusdt@kline_1h',
    kline: {
      startTime: 1_700_000_000_000,
      closeTime: 1_700_003_599_999,
      symbol: 'BTCUSDT',
      interval: '1h',
      firstTradeId: 100,
      lastTradeId: 200,
      open: '100',
      close: '105',
      high: '110',
      low: '90',
      volume: '12.5',
      tradeCount: 101,
      isClosed,
      quoteVolume: '1312.5',
      takerBuyBaseVolume: '6.1',
      takerBuyQuoteVolume: '640.5',
    },
  };
}

describe(
  'mapClosedWebSocketKline',
  () => {
    it('maps a closed event', () => {
      const receivedAt = new Date(
        '2026-01-01T01:00:00.000Z',
      );

      const candle =
        mapClosedWebSocketKline(
          createEvent(true),
          receivedAt,
        );

      expect(candle).toMatchObject({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        isClosed: true,
      });

      expect(
        candle?.receivedAt,
      ).toEqual(receivedAt);
    });

    it('ignores a forming event', () => {
      expect(
        mapClosedWebSocketKline(
          createEvent(false),
          new Date(),
        ),
      ).toBeNull();
    });

    it('rejects invalid OHLC', () => {
      const event = createEvent(true);

      event.kline.high = '99';

      expect(() =>
        mapClosedWebSocketKline(
          event,
          new Date(),
        ),
      ).toThrow();
    });
  },
);