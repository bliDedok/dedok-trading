import {
  supportedSymbols,
  supportedTimeframes,
  symbolSchema,
  timeframeSchema,
  type SupportedSymbol,
  type SupportedTimeframe,
} from '@dedok/shared';
import { z } from 'zod';

import type {
  BinanceWebSocketKlineEvent,
  BinanceWebSocketParseResult,
} from './binance-websocket-types.js';

const numericStringSchema = z
  .string()
  .min(1)
  .refine(
    (value) => Number.isFinite(Number(value)),
    'Expected a numeric string',
  );

const rawKlineSchema = z.object({
  t: z.number().int().nonnegative(),
  T: z.number().int().nonnegative(),
  s: z.string().min(1),
  i: z.string().min(1),
  f: z.number().int(),
  L: z.number().int(),
  o: numericStringSchema,
  c: numericStringSchema,
  h: numericStringSchema,
  l: numericStringSchema,
  v: numericStringSchema,
  n: z.number().int().nonnegative(),
  x: z.boolean(),
  q: numericStringSchema,
  V: numericStringSchema,
  Q: numericStringSchema,
});

const rawKlineEventSchema = z.object({
  stream: z.string().min(1),
  data: z.object({
    e: z.string().min(1),
    E: z.number().int().nonnegative(),
    s: z.string().min(1),
    k: rawKlineSchema,
  }),
});

function parseJsonMessage(
  message: string | Buffer,
): unknown {
  const text = Buffer.isBuffer(message)
    ? message.toString('utf8')
    : message;

  return JSON.parse(text) as unknown;
}

function normalizeSymbol(
  value: string,
): SupportedSymbol | null {
  const parsed = symbolSchema.safeParse(
    value.toUpperCase(),
  );

  return parsed.success ? parsed.data : null;
}

function normalizeTimeframe(
  value: string,
): SupportedTimeframe | null {
  const parsed = timeframeSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function buildBinanceKlineStreamName(
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
): string {
  return `${symbol.toLowerCase()}@kline_${timeframe}`;
}

export function buildBinanceCombinedStreamUrl(
  baseUrl: string,
  symbols: readonly SupportedSymbol[] =
    supportedSymbols,
  timeframes: readonly SupportedTimeframe[] =
    supportedTimeframes,
): URL {
  if (symbols.length === 0) {
    throw new RangeError(
      'At least one Binance WebSocket symbol is required',
    );
  }

  if (timeframes.length === 0) {
    throw new RangeError(
      'At least one Binance WebSocket timeframe is required',
    );
  }

  const url = new URL(baseUrl);

  const streams = symbols.flatMap((symbol) =>
    timeframes.map((timeframe) =>
      buildBinanceKlineStreamName(
        symbol,
        timeframe,
      ),
    ),
  );

  const normalizedPath = url.pathname.replace(
    /\/+$/,
    '',
  );

  /*
   * .env awal menggunakan:
   * wss://stream.binance.com:9443
   *
   * Hasilnya:
   * wss://stream.binance.com:9443/stream?streams=...
   */
  if (
    normalizedPath === '' ||
    normalizedPath === '/'
  ) {
    url.pathname = '/stream';
  } else if (normalizedPath.endsWith('/ws')) {
    url.pathname = `${normalizedPath.slice(
      0,
      -3,
    )}/stream`;
  } else if (
    !normalizedPath.endsWith('/stream')
  ) {
    url.pathname = `${normalizedPath}/stream`;
  }

  url.search = '';
  url.searchParams.set(
    'streams',
    streams.join('/'),
  );

  return url;
}

export function parseBinanceWebSocketMessage(
  message: string | Buffer,
): BinanceWebSocketParseResult {
  let json: unknown;

  try {
    json = parseJsonMessage(message);
  } catch {
    return {
      success: false,
      reason: 'INVALID_JSON',
    };
  }

  const parsed =
    rawKlineEventSchema.safeParse(json);

  if (!parsed.success) {
    return {
      success: false,
      reason: 'INVALID_PAYLOAD',
    };
  }

  if (parsed.data.data.e !== 'kline') {
    return {
      success: false,
      reason: 'UNSUPPORTED_EVENT',
    };
  }

  const eventSymbol = normalizeSymbol(
    parsed.data.data.s,
  );

  const klineSymbol = normalizeSymbol(
    parsed.data.data.k.s,
  );

  if (
    eventSymbol === null ||
    klineSymbol === null
  ) {
    return {
      success: false,
      reason: 'UNSUPPORTED_SYMBOL',
    };
  }

  const timeframe = normalizeTimeframe(
    parsed.data.data.k.i,
  );

  if (timeframe === null) {
    return {
      success: false,
      reason: 'UNSUPPORTED_TIMEFRAME',
    };
  }

  const expectedStream =
    buildBinanceKlineStreamName(
      eventSymbol,
      timeframe,
    );

  if (
    eventSymbol !== klineSymbol ||
    parsed.data.stream.toLowerCase() !==
      expectedStream
  ) {
    return {
      success: false,
      reason: 'STREAM_MISMATCH',
    };
  }

  const event: BinanceWebSocketKlineEvent = {
    eventType: 'kline',
    eventTime: parsed.data.data.E,
    symbol: eventSymbol,
    stream: parsed.data.stream,
    kline: {
      startTime: parsed.data.data.k.t,
      closeTime: parsed.data.data.k.T,
      symbol: klineSymbol,
      interval: timeframe,
      firstTradeId: parsed.data.data.k.f,
      lastTradeId: parsed.data.data.k.L,
      open: parsed.data.data.k.o,
      close: parsed.data.data.k.c,
      high: parsed.data.data.k.h,
      low: parsed.data.data.k.l,
      volume: parsed.data.data.k.v,
      tradeCount: parsed.data.data.k.n,
      isClosed: parsed.data.data.k.x,
      quoteVolume: parsed.data.data.k.q,
      takerBuyBaseVolume:
        parsed.data.data.k.V,
      takerBuyQuoteVolume:
        parsed.data.data.k.Q,
    },
  };

  return {
    success: true,
    event,
  };
}