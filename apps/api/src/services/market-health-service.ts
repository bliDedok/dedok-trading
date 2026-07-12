import {
  supportedSymbols,
  supportedTimeframes,
  type SupportedTimeframe,
} from '@dedok/shared';

import type {
  LatestCandleTimeDto,
  MarketQueryRepositoryContract,
} from '../repositories/market-query-repository.js';

export type MarketHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN';

export interface MarketHealthItem {
  symbol: LatestCandleTimeDto['symbol'];
  timeframe: SupportedTimeframe;
  closeTime: string;
  ageMs: number;
  staleAfterMs: number;
  stale: boolean;
}

export interface MarketHealthResult {
  status: MarketHealthStatus;
  checkedAt: string;
  expectedMarkets: number;
  availableMarkets: number;
  staleMarkets: number;
  markets: MarketHealthItem[];
}

const timeframeDurationMs: Record<
  SupportedTimeframe,
  number
> = {
  '15m': 15 * 60 * 1_000,
  '1h': 60 * 60 * 1_000,
  '4h': 4 * 60 * 60 * 1_000,
  '1d': 24 * 60 * 60 * 1_000,
};

const HEALTH_GRACE_MS =
  5 * 60 * 1_000;

export class MarketHealthService {
  public constructor(
    private readonly repository:
      MarketQueryRepositoryContract,
  ) {}

  public async evaluate(
    now: Date = new Date(),
  ): Promise<MarketHealthResult> {
    const latest =
      await this.repository.listLatestCandleTimes();

    const expectedMarkets =
      supportedSymbols.length *
      supportedTimeframes.length;

    const markets = latest.map((item) => {
      const closeTime = new Date(
        item.closeTime,
      );

      const ageMs = Math.max(
        now.getTime() -
          closeTime.getTime(),
        0,
      );

      const staleAfterMs =
        timeframeDurationMs[
          item.timeframe
        ] *
          2 +
        HEALTH_GRACE_MS;

      return {
        symbol: item.symbol,
        timeframe: item.timeframe,
        closeTime: item.closeTime,
        ageMs,
        staleAfterMs,
        stale:
          ageMs > staleAfterMs,
      };
    });

    const staleMarkets =
      markets.filter(
        (market) => market.stale,
      ).length;

    let status: MarketHealthStatus;

    if (markets.length === 0) {
      status = 'DOWN';
    } else if (
      markets.length <
        expectedMarkets ||
      staleMarkets > 0
    ) {
      status = 'DEGRADED';
    } else {
      status = 'HEALTHY';
    }

    return {
      status,
      checkedAt: now.toISOString(),
      expectedMarkets,
      availableMarkets:
        markets.length,
      staleMarkets,
      markets,
    };
  }
}