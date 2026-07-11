import {
  candleInputSchema,
  type SupportedSymbol,
  type SupportedTimeframe,
} from '@dedok/shared';

import type {
  BinanceKline,
  ClosedCandle,
} from './binance-types.js';

export function mapClosedBinanceKline(
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
  kline: BinanceKline,
  receivedAt: Date,
): ClosedCandle | null {
  const openTime = new Date(kline[0]);
  const closeTime = new Date(kline[6]);

  if (
    Number.isNaN(openTime.getTime()) ||
    Number.isNaN(closeTime.getTime())
  ) {
    throw new RangeError(
      'Binance kline contains invalid timestamps',
    );
  }

  /*
   * Binance REST dapat mengembalikan candle yang sedang
   * terbentuk sebagai elemen terakhir. Candle dianggap
   * selesai hanya jika closeTime sudah berada di masa lalu.
   */
  if (closeTime.getTime() >= receivedAt.getTime()) {
    return null;
  }

  const parsed = candleInputSchema.parse({
    symbol,
    timeframe,
    openTime,
    closeTime,
    open: kline[1],
    high: kline[2],
    low: kline[3],
    close: kline[4],
    volume: kline[5],
    quoteVolume: kline[7],
    tradeCount: kline[8],
    takerBuyBaseVolume: kline[9],
    takerBuyQuoteVolume: kline[10],
    isClosed: true,
    receivedAt,
  });

  return {
    ...parsed,
    isClosed: true,
  };
}

export function mapClosedBinanceKlines(
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
  klines: readonly BinanceKline[],
  receivedAt: Date,
): ClosedCandle[] {
  const candles: ClosedCandle[] = [];

  for (const kline of klines) {
    const candle = mapClosedBinanceKline(
      symbol,
      timeframe,
      kline,
      receivedAt,
    );

    if (candle !== null) {
      candles.push(candle);
    }
  }

  return candles;
}