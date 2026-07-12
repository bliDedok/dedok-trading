import { z } from 'zod';

export const supportedSymbols = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
] as const;

export const supportedTimeframes = [
  '15m',
  '1h',
  '4h',
  '1d',
] as const;

export const symbolSchema = z.enum(supportedSymbols);

export const timeframeSchema = z.enum(supportedTimeframes);

export type SupportedSymbol = z.infer<typeof symbolSchema>;

export type SupportedTimeframe = z.infer<typeof timeframeSchema>;

export const timeframeToDatabase = {
  '15m': 'M15',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D1',
} as const;

export const databaseToTimeframe = {
  M15: '15m',
  H1: '1h',
  H4: '4h',
  D1: '1d',
} as const;

const decimalStringSchema = z
  .string()
  .regex(/^\d+(?:\.\d+)?$/, 'Expected a positive decimal string');

export const candleInputSchema = z
  .object({
    symbol: symbolSchema,
    timeframe: timeframeSchema,
    openTime: z.coerce.date(),
    closeTime: z.coerce.date(),
    open: decimalStringSchema,
    high: decimalStringSchema,
    low: decimalStringSchema,
    close: decimalStringSchema,
    volume: decimalStringSchema,
    quoteVolume: decimalStringSchema,
    tradeCount: z.number().int().nonnegative(),
    takerBuyBaseVolume: decimalStringSchema,
    takerBuyQuoteVolume: decimalStringSchema,
    isClosed: z.boolean(),
    receivedAt: z.coerce.date(),
  })
  .superRefine((value, context) => {
    if (value.closeTime <= value.openTime) {
      context.addIssue({
        code: 'custom',
        path: ['closeTime'],
        message: 'closeTime must be after openTime',
      });
    }

    const open = Number(value.open);
    const high = Number(value.high);
    const low = Number(value.low);
    const close = Number(value.close);

    if (![open, high, low, close].every(Number.isFinite)) {
      context.addIssue({
        code: 'custom',
        path: ['open'],
        message: 'OHLC values must be finite',
      });

      return;
    }

    const highestBodyPrice = Math.max(open, close);
    const lowestBodyPrice = Math.min(open, close);

    if (
      high < highestBodyPrice ||
      low > lowestBodyPrice ||
      high < low
    ) {
      context.addIssue({
        code: 'custom',
        path: ['high'],
        message: 'Invalid OHLC relationship',
      });
    }
  });

export type CandleInput = z.infer<typeof candleInputSchema>;

export const marketAssetsResponseSchema = z.object({
  data: z.array(
    z.object({
      symbol: symbolSchema,
      baseAsset: z.string().min(1),
      quoteAsset: z.string().min(1),
      status: z.enum(['ACTIVE', 'INACTIVE']),
      latestCandleTime: z.string().datetime().nullable(),
    }),
  ),
});

export type MarketAssetsResponse = z.infer<
  typeof marketAssetsResponseSchema
>;

export const marketCandlesQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  limit: z.coerce.number().int().min(1).max(1000).default(300),
  before: z.string().datetime().optional(),
});

export const marketCandleSchema = z.object({
  id: z.string().min(1),
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  source: z.literal('BINANCE'),
  openTime: z.string().datetime(),
  closeTime: z.string().datetime(),
  open: decimalStringSchema,
  high: decimalStringSchema,
  low: decimalStringSchema,
  close: decimalStringSchema,
  volume: decimalStringSchema,
  quoteVolume: decimalStringSchema,
  tradeCount: z.number().int().nonnegative(),
  takerBuyBaseVolume: decimalStringSchema,
  takerBuyQuoteVolume: decimalStringSchema,
  isClosed: z.literal(true),
  receivedAt: z.string().datetime(),
});

export type MarketCandle = z.infer<
  typeof marketCandleSchema
>;

export const marketCandlesResponseSchema = z.object({
  data: z.array(marketCandleSchema),
  pagination: z.object({
    limit: z.number().int().positive(),
    nextBefore: z.string().datetime().nullable(),
    hasMore: z.boolean(),
  }),
});

export type MarketCandlesResponse = z.infer<
  typeof marketCandlesResponseSchema
>;

export type MarketCandlesQuery = z.infer<
  typeof marketCandlesQuerySchema
>;

export const latestCandleQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
});

export type LatestCandleQuery = z.infer<
  typeof latestCandleQuerySchema
>;

export const latestCandleResponseSchema = z.object({
  data: marketCandleSchema,
});

export type LatestCandleResponse = z.infer<
  typeof latestCandleResponseSchema
>;

export const marketHealthItemSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  closeTime: z.string().datetime(),
  ageMs: z.number().int().nonnegative(),
  staleAfterMs: z.number().int().positive(),
  stale: z.boolean(),
});

export const marketHealthResponseSchema = z.object({
  status: z.enum([
    'HEALTHY',
    'DEGRADED',
    'DOWN',
  ]),
  checkedAt: z.string().datetime(),
  expectedMarkets: z.number().int().positive(),
  availableMarkets: z.number().int().nonnegative(),
  staleMarkets: z.number().int().nonnegative(),
  markets: z.array(marketHealthItemSchema),
});

export type MarketHealthResponse = z.infer<
  typeof marketHealthResponseSchema
>;

export const latestIndicatorQuerySchema =
  z.object({
    symbol: symbolSchema,
    timeframe: timeframeSchema,
    historyLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(300),
  });

export type LatestIndicatorQuery =
  z.infer<
    typeof latestIndicatorQuerySchema
  >;

const nullableIndicatorValueSchema =
  z.number().finite().nullable();

const indicatorPeriodRecordSchema =
  z.record(
    z.string(),
    nullableIndicatorValueSchema,
  );

export const indicatorSnapshotSchema =
  z.object({
    calculatedAt:
      z.string().datetime(),
    candleOpenTime:
      z.string().datetime(),
    candleCloseTime:
      z.string().datetime(),
    close: z.number().finite(),
    sma: indicatorPeriodRecordSchema,
    ema: indicatorPeriodRecordSchema,
    rsi: indicatorPeriodRecordSchema,
    atr: indicatorPeriodRecordSchema,
    macd: z.object({
      macd:
        nullableIndicatorValueSchema,
      signal:
        nullableIndicatorValueSchema,
      histogram:
        nullableIndicatorValueSchema,
    }),
    bollingerBands: z.object({
      middle:
        nullableIndicatorValueSchema,
      upper:
        nullableIndicatorValueSchema,
      lower:
        nullableIndicatorValueSchema,
    }),
  });

export type IndicatorSnapshotResponseData =
  z.infer<
    typeof indicatorSnapshotSchema
  >;

export const latestIndicatorResponseSchema =
  z.object({
    data: z.object({
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      candleCount: z
        .number()
        .int()
        .nonnegative(),
      snapshot:
        indicatorSnapshotSchema,
    }),
  });

export type LatestIndicatorResponse =
  z.infer<
    typeof latestIndicatorResponseSchema
  >;

  export const latestSignalQuerySchema =
  latestIndicatorQuerySchema;

export type LatestSignalQuery =
  z.infer<
    typeof latestSignalQuerySchema
  >;

export const tradingSignalSchema =
  z.enum([
    'LONG',
    'SHORT',
    'NEUTRAL',
  ]);

export const strategyRuleDirectionSchema =
  z.enum([
    'BULLISH',
    'BEARISH',
    'NEUTRAL',
  ]);

export const strategyRuleResultSchema =
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    direction:
      strategyRuleDirectionSchema,
    score: z
      .number()
      .finite()
      .min(0)
      .max(100),
    reason: z.string().min(1),
  });

export const latestSignalResponseSchema =
  z.object({
    data: z.object({
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      candleCount: z
        .number()
        .int()
        .nonnegative(),
      signal: tradingSignalSchema,
      confidence: z
        .number()
        .finite()
        .min(0)
        .max(100),
      bullishScore: z
        .number()
        .finite()
        .min(0)
        .max(100),
      bearishScore: z
        .number()
        .finite()
        .min(0)
        .max(100),
      evaluatedAt:
        z.string().datetime(),
      candleCloseTime:
        z.string().datetime(),
      reasons:
        z.array(z.string()),
      rules:
        z.array(
          strategyRuleResultSchema,
        ),
    }),
  });

export type LatestSignalResponse =
  z.infer<
    typeof latestSignalResponseSchema
  >;