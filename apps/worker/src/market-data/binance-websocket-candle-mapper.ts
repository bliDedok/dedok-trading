import {
  candleInputSchema,
  type CandleInput,
} from '@dedok/shared';

import type {
  BinanceWebSocketKlineEvent,
} from './binance-websocket-types.js';

export function mapClosedWebSocketKline(
  event: BinanceWebSocketKlineEvent,
  receivedAt: Date,
): CandleInput | null {
  if (!event.kline.isClosed) {
    return null;
  }

  const openTime = new Date(
    event.kline.startTime,
  );

  const closeTime = new Date(
    event.kline.closeTime,
  );

  if (
    Number.isNaN(openTime.getTime()) ||
    Number.isNaN(closeTime.getTime())
  ) {
    throw new RangeError(
      'Binance WebSocket kline contains invalid timestamps',
    );
  }

  return candleInputSchema.parse({
    symbol: event.symbol,
    timeframe: event.kline.interval,
    openTime,
    closeTime,
    open: event.kline.open,
    high: event.kline.high,
    low: event.kline.low,
    close: event.kline.close,
    volume: event.kline.volume,
    quoteVolume:
      event.kline.quoteVolume,
    tradeCount:
      event.kline.tradeCount,
    takerBuyBaseVolume:
      event.kline.takerBuyBaseVolume,
    takerBuyQuoteVolume:
      event.kline.takerBuyQuoteVolume,
    isClosed: true,
    receivedAt,
  });
}