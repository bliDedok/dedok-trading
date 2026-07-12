import type {
  SupportedSymbol,
  SupportedTimeframe,
} from '@dedok/shared';

export interface BinanceWebSocketKline {
  startTime: number;
  closeTime: number;
  symbol: SupportedSymbol;
  interval: SupportedTimeframe;
  firstTradeId: number;
  lastTradeId: number;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  tradeCount: number;
  isClosed: boolean;
  quoteVolume: string;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export interface BinanceWebSocketKlineEvent {
  eventType: 'kline';
  eventTime: number;
  symbol: SupportedSymbol;
  stream: string;
  kline: BinanceWebSocketKline;
}

export interface BinanceWebSocketParseSuccess {
  success: true;
  event: BinanceWebSocketKlineEvent;
}

export interface BinanceWebSocketParseIgnored {
  success: false;
  reason:
    | 'INVALID_JSON'
    | 'INVALID_PAYLOAD'
    | 'UNSUPPORTED_EVENT'
    | 'UNSUPPORTED_SYMBOL'
    | 'UNSUPPORTED_TIMEFRAME'
    | 'STREAM_MISMATCH';
}

export type BinanceWebSocketParseResult =
  | BinanceWebSocketParseSuccess
  | BinanceWebSocketParseIgnored;