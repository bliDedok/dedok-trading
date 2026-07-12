import {
  IndicatorSnapshotService,
  type IndicatorSnapshot,
} from '@dedok/indicators';
import type {
  SupportedSymbol,
  SupportedTimeframe,
} from '@dedok/shared';

import type {
  IndicatorQueryRepositoryContract,
} from '../repositories/indicator-query-repository.js';

export interface LatestIndicatorResult {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  candleCount: number;
  snapshot: IndicatorSnapshot;
}

export class LatestIndicatorService {
  public constructor(
    private readonly repository:
      IndicatorQueryRepositoryContract,
    private readonly snapshotService =
      new IndicatorSnapshotService(),
  ) {}

  public async getLatest(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
    historyLimit: number,
  ): Promise<LatestIndicatorResult | null> {
    const candles =
      await this.repository.listClosedCandles(
        symbol,
        timeframe,
        historyLimit,
      );

    const snapshot =
      this.snapshotService.calculate(
        candles,
      );

    if (snapshot === null) {
      return null;
    }

    return {
      symbol,
      timeframe,
      candleCount: candles.length,
      snapshot,
    };
  }
}