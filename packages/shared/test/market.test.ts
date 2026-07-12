import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  candleInputSchema,
  databaseToTimeframe,
  latestIndicatorQuerySchema,
  latestIndicatorResponseSchema,
  marketCandlesResponseSchema,
  timeframeToDatabase,
} from '../src/market.js';

describe('market contracts', () => {
  it('maps supported timeframes to database enums', () => {
    expect(
      timeframeToDatabase['15m'],
    ).toBe('M15');

    expect(
      timeframeToDatabase['1h'],
    ).toBe('H1');

    expect(
      timeframeToDatabase['4h'],
    ).toBe('H4');

    expect(
      timeframeToDatabase['1d'],
    ).toBe('D1');
  });

  it('maps database enums to public timeframes', () => {
    expect(
      databaseToTimeframe.M15,
    ).toBe('15m');

    expect(
      databaseToTimeframe.H1,
    ).toBe('1h');

    expect(
      databaseToTimeframe.H4,
    ).toBe('4h');

    expect(
      databaseToTimeframe.D1,
    ).toBe('1d');
  });

  it('accepts a valid closed candle', () => {
    const result =
      candleInputSchema.safeParse({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        openTime: new Date(
          '2026-01-01T00:00:00.000Z',
        ),
        closeTime: new Date(
          '2026-01-01T00:59:59.999Z',
        ),
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
        receivedAt: new Date(
          '2026-01-01T01:00:01.000Z',
        ),
      });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid OHLC relationship', () => {
    const result =
      candleInputSchema.safeParse({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        openTime: new Date(
          '2026-01-01T00:00:00.000Z',
        ),
        closeTime: new Date(
          '2026-01-01T00:59:59.999Z',
        ),
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
        receivedAt: new Date(
          '2026-01-01T01:00:01.000Z',
        ),
      });

    expect(result.success).toBe(false);
  });

  it('rejects a close time before the open time', () => {
    const result =
      candleInputSchema.safeParse({
        symbol: 'ETHUSDT',
        timeframe: '15m',
        openTime: new Date(
          '2026-01-01T01:00:00.000Z',
        ),
        closeTime: new Date(
          '2026-01-01T00:59:59.999Z',
        ),
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
        receivedAt: new Date(
          '2026-01-01T01:00:01.000Z',
        ),
      });

    expect(result.success).toBe(false);
  });
});

describe(
  'marketCandlesResponseSchema',
  () => {
    it('accepts a valid candle page', () => {
      const result =
        marketCandlesResponseSchema.parse(
          {
            data: [
              {
                id: 'candle-1',
                symbol: 'BTCUSDT',
                timeframe: '15m',
                source: 'BINANCE',
                openTime:
                  '2026-07-12T00:30:00.000Z',
                closeTime:
                  '2026-07-12T00:44:59.999Z',
                open:
                  '118000.000000000000',
                high:
                  '118500.000000000000',
                low:
                  '117900.000000000000',
                close:
                  '118300.000000000000',
                volume:
                  '123.450000000000000000',
                quoteVolume:
                  '14500000.000000000000000000',
                tradeCount: 1234,
                takerBuyBaseVolume:
                  '60.000000000000000000',
                takerBuyQuoteVolume:
                  '7100000.000000000000000000',
                isClosed: true,
                receivedAt:
                  '2026-07-12T00:45:00.220Z',
              },
            ],
            pagination: {
              limit: 100,
              nextBefore: null,
              hasMore: false,
            },
          },
        );

      expect(
        result.data,
      ).toHaveLength(1);

      expect(
        result.data[0]?.symbol,
      ).toBe('BTCUSDT');
    });
  },
);

describe(
  'indicator API contracts',
  () => {
    it('parses a latest indicator query', () => {
      const result =
        latestIndicatorQuerySchema.parse(
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            historyLimit: '250',
          },
        );

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        historyLimit: 250,
      });
    });

    it('applies the default history limit', () => {
      const result =
        latestIndicatorQuerySchema.parse(
          {
            symbol: 'ETHUSDT',
            timeframe: '1h',
          },
        );

      expect(
        result.historyLimit,
      ).toBe(300);
    });

    it('accepts an indicator snapshot response', () => {
      const response = {
        data: {
          symbol: 'BTCUSDT',
          timeframe: '15m',
          candleCount: 300,
          snapshot: {
            calculatedAt:
              '2026-07-12T05:00:00.000Z',
            candleOpenTime:
              '2026-07-12T04:30:00.000Z',
            candleCloseTime:
              '2026-07-12T04:44:59.999Z',
            close: 64025.17,
            sma: {
              '20': 63980.4,
              '50': null,
            },
            ema: {
              '9': 64010.2,
            },
            rsi: {
              '14': 61.25,
            },
            atr: {
              '14': 185.4,
            },
            macd: {
              macd: 12.5,
              signal: 10.2,
              histogram: 2.3,
            },
            bollingerBands: {
              middle: 63980.4,
              upper: 64250.7,
              lower: 63710.1,
            },
          },
        },
      };

      expect(() =>
        latestIndicatorResponseSchema.parse(
          response,
        ),
      ).not.toThrow();
    });
  },
);