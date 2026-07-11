import type {
  CandleInput,
  SupportedSymbol,
  SupportedTimeframe,
} from '@dedok/shared';

export interface BinanceKlineRequest {
  symbol: SupportedSymbol;
  interval: SupportedTimeframe;
  limit: number;
  startTime?: number;
  endTime?: number;
}

export interface BinanceRestClientOptions {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  fetchImplementation?: typeof fetch;
  retryDelayImplementation?: (
    milliseconds: number,
  ) => Promise<void>;
}

export type BinanceKline = readonly [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: number,
  quoteVolume: string,
  tradeCount: number,
  takerBuyBaseVolume: string,
  takerBuyQuoteVolume: string,
  unused: string,
];

export type ClosedCandle = CandleInput & {
  isClosed: true;
};