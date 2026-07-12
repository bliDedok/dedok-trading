import type {
  SupportedSymbol,
  SupportedTimeframe,
} from '@dedok/shared';
import {
  TechnicalStrategy,
  type StrategySignalResult,
} from '@dedok/strategies';

import type {
  LatestIndicatorService,
} from './latest-indicator-service.js';

export interface LatestSignalResult {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  candleCount: number;
  signal: StrategySignalResult;
}

export class LatestSignalService {
  public constructor(
    private readonly indicatorService:
      LatestIndicatorService,
    private readonly strategy =
      new TechnicalStrategy(),
  ) {}

  public async getLatest(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
    historyLimit: number,
  ): Promise<LatestSignalResult | null> {
    const indicatorResult =
      await this.indicatorService.getLatest(
        symbol,
        timeframe,
        historyLimit,
      );

    if (indicatorResult === null) {
      return null;
    }

    const signal =
      this.strategy.evaluate(
        indicatorResult.snapshot,
      );

    return {
      symbol:
        indicatorResult.symbol,
      timeframe:
        indicatorResult.timeframe,
      candleCount:
        indicatorResult.candleCount,
      signal,
    };
  }
}