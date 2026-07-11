import {
  supportedSymbols,
  supportedTimeframes,
  type SupportedSymbol,
  type SupportedTimeframe,
} from '@dedok/shared';

import { mvpAssets } from '../market-data/assets.js';
import type {
  BinanceKline,
  BinanceKlineRequest,
} from '../market-data/binance-types.js';
import { mapClosedBinanceKlines } from '../market-data/candle-mapper.js';
import type {
  MarketDataRepositoryContract,
  StoreCandlesResult,
} from '../repositories/market-data-repository.js';

export interface BinanceKlineClient {
  getKlines(
    request: BinanceKlineRequest,
  ): Promise<BinanceKline[]>;
}

export interface HistoricalSyncLogger {
  info(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  warn(
    bindings: Record<string, unknown>,
    message: string,
  ): void;

  error(
    bindings: Record<string, unknown>,
    message: string,
  ): void;
}

export interface HistoricalCandleSyncOptions {
  candleLimit: number;
  symbols?: readonly SupportedSymbol[];
  timeframes?: readonly SupportedTimeframe[];
}

export interface HistoricalSyncItemResult
  extends StoreCandlesResult {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
}

export interface HistoricalSyncResult {
  startedAt: Date;
  completedAt: Date;
  items: HistoricalSyncItemResult[];
  totalReceived: number;
  totalInserted: number;
  totalSkipped: number;
  failures: number;
}

export class HistoricalCandleSync {
  private running = false;

  public constructor(
    private readonly client: BinanceKlineClient,
    private readonly repository:
      MarketDataRepositoryContract,
    private readonly logger: HistoricalSyncLogger,
    private readonly options:
      HistoricalCandleSyncOptions,
  ) {
    if (
      !Number.isInteger(options.candleLimit) ||
      options.candleLimit < 1 ||
      options.candleLimit > 1000
    ) {
      throw new RangeError(
        'Historical candle limit must be an integer between 1 and 1000',
      );
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async run(): Promise<HistoricalSyncResult> {
    if (this.running) {
      throw new Error(
        'Historical candle synchronization is already running',
      );
    }

    this.running = true;

    const startedAt = new Date();
    const items: HistoricalSyncItemResult[] = [];
    let failures = 0;

    try {
      const assetIds =
        await this.repository.upsertAssets(
          mvpAssets,
        );

      const symbols =
        this.options.symbols ?? supportedSymbols;

      const timeframes =
        this.options.timeframes ??
        supportedTimeframes;

      for (const symbol of symbols) {
        const assetId = assetIds.get(symbol);

        if (assetId === undefined) {
          failures += timeframes.length;

          this.logger.error(
            {
              symbol,
            },
            'Asset ID was not returned after asset upsert',
          );

          continue;
        }

        for (const timeframe of timeframes) {
          try {
            const result =
              await this.syncSymbolTimeframe(
                assetId,
                symbol,
                timeframe,
              );

            items.push(result);

            this.logger.info(
              {
                symbol,
                timeframe,
                received: result.received,
                inserted: result.inserted,
                skipped: result.skipped,
              },
              'Historical candles synchronized',
            );
          } catch (error: unknown) {
            failures += 1;

            this.logger.error(
              {
                symbol,
                timeframe,
                error:
                  error instanceof Error
                    ? {
                        name: error.name,
                        message: error.message,
                      }
                    : {
                        message:
                          'Unknown historical sync error',
                      },
              },
              'Historical candle synchronization failed',
            );
          }
        }
      }

      const completedAt = new Date();

      return {
        startedAt,
        completedAt,
        items,
        totalReceived: items.reduce(
          (total, item) =>
            total + item.received,
          0,
        ),
        totalInserted: items.reduce(
          (total, item) =>
            total + item.inserted,
          0,
        ),
        totalSkipped: items.reduce(
          (total, item) =>
            total + item.skipped,
          0,
        ),
        failures,
      };
    } finally {
      this.running = false;
    }
  }

  private async syncSymbolTimeframe(
    assetId: string,
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
  ): Promise<HistoricalSyncItemResult> {
    const receivedAt = new Date();

    const klines =
      await this.client.getKlines({
        symbol,
        interval: timeframe,
        limit: this.options.candleLimit,
      });

    const candles =
      mapClosedBinanceKlines(
        symbol,
        timeframe,
        klines,
        receivedAt,
      );

    const stored =
      await this.repository.storeClosedCandles(
        assetId,
        symbol,
        candles,
      );

    return {
      symbol,
      timeframe,
      ...stored,
    };
  }
}