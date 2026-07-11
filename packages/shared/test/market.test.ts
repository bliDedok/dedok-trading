import { describe, expect, it } from 'vitest';

import {
  candleInputSchema,
  databaseToTimeframe,
  timeframeToDatabase,
} from '../src/market.js';

describe('market contracts', () => {
  it('maps supported timeframes to database enums', () => {
    expect(timeframeToDatabase['15m']).toBe('M15');
    expect(timeframeToDatabase['1h']).toBe('H1');
    expect(timeframeToDatabase['4h']).toBe('H4');
    expect(timeframeToDatabase['1d']).toBe('D1');
  });

  it('maps database enums to public timeframes', () => {
    expect(databaseToTimeframe.M15).toBe('15m');
    expect(databaseToTimeframe.H1).toBe('1h');
    expect(databaseToTimeframe.H4).toBe('4h');
    expect(databaseToTimeframe.D1).toBe('1d');
  });

  it('accepts a valid closed candle', () => {
    const result = candleInputSchema.safeParse({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      openTime: new Date('2026-01-01T00:00:00.000Z'),
      closeTime: new Date('2026-01-01T00:59:59.999Z'),
      open: '100',
      high: '105',
      low: '95',
      close: '102',
      volume: '10',
      quoteVolume: '1020',
      tradeCount: 5,
      takerBuyBaseVolume: '4',
      takerBuyQuoteVolume: '408',
      isClosed: true,
      receivedAt: new Date('2026-01-01T01:00:01.000Z'),
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid OHLC relationship', () => {
    const result = candleInputSchema.safeParse({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      openTime: new Date('2026-01-01T00:00:00.000Z'),
      closeTime: new Date('2026-01-01T00:59:59.999Z'),
      open: '100',
      high: '99',
      low: '95',
      close: '98',
      volume: '10',
      quoteVolume: '980',
      tradeCount: 5,
      takerBuyBaseVolume: '4',
      takerBuyQuoteVolume: '392',
      isClosed: true,
      receivedAt: new Date('2026-01-01T01:00:01.000Z'),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a close time before the open time', () => {
    const result = candleInputSchema.safeParse({
      symbol: 'ETHUSDT',
      timeframe: '15m',
      openTime: new Date('2026-01-01T01:00:00.000Z'),
      closeTime: new Date('2026-01-01T00:59:59.999Z'),
      open: '100',
      high: '105',
      low: '95',
      close: '102',
      volume: '10',
      quoteVolume: '1020',
      tradeCount: 5,
      takerBuyBaseVolume: '4',
      takerBuyQuoteVolume: '408',
      isClosed: true,
      receivedAt: new Date('2026-01-01T01:00:01.000Z'),
    });

    expect(result.success).toBe(false);
  });
});