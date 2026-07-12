import type {
  SupportedSymbol,
} from '@dedok/shared';

import { mvpAssets } from '../market-data/assets.js';
import {
  mapClosedWebSocketKline,
} from '../market-data/binance-websocket-candle-mapper.js';
import type {
  BinanceWebSocketKlineEvent,
} from '../market-data/binance-websocket-types.js';
import type {
  MarketDataRepositoryContract,
} from '../repositories/market-data-repository.js';

export interface LiveCandleLogger {
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

export interface LiveCandleServiceHealth {
  initialized: boolean;
  queuedEvents: number;
  processedEvents: number;
  insertedCandles: number;
  skippedCandles: number;
  ignoredFormingCandles: number;
  failedEvents: number;
  lastEventAt: Date | null;
  lastPersistedAt: Date | null;
}

export class LiveCandleService {
  private assetIds =
    new Map<SupportedSymbol, string>();

  private initialized = false;

  private queue: Promise<void> =
    Promise.resolve();

  private queuedEvents = 0;

  private processedEvents = 0;

  private insertedCandles = 0;

  private skippedCandles = 0;

  private ignoredFormingCandles = 0;

  private failedEvents = 0;

  private lastEventAt: Date | null = null;

  private lastPersistedAt: Date | null = null;

  public constructor(
    private readonly repository:
      MarketDataRepositoryContract,
    private readonly logger:
      LiveCandleLogger,
  ) {}

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.assetIds =
      await this.repository.upsertAssets(
        mvpAssets,
      );

    this.initialized = true;

    this.logger.info(
      {
        assetCount: this.assetIds.size,
      },
      'Live candle service initialized',
    );
  }

  public enqueue(
    event: BinanceWebSocketKlineEvent,
  ): Promise<void> {
    this.queuedEvents += 1;
    this.lastEventAt = new Date();

    const execution = this.queue.then(
      async () => {
        await this.processEvent(event);
      },
    );

    this.queue = execution.catch(
      (error: unknown) => {
        this.failedEvents += 1;

        this.logger.error(
          {
            symbol: event.symbol,
            timeframe:
              event.kline.interval,
            stream: event.stream,
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : {
                    message:
                      'Unknown live candle processing error',
                  },
          },
          'Live candle processing failed',
        );
      },
    );

    return execution;
  }

  public async waitForIdle(): Promise<void> {
    await this.queue;
  }

  public getHealth():
    LiveCandleServiceHealth {
    return {
      initialized: this.initialized,
      queuedEvents: this.queuedEvents,
      processedEvents:
        this.processedEvents,
      insertedCandles:
        this.insertedCandles,
      skippedCandles:
        this.skippedCandles,
      ignoredFormingCandles:
        this.ignoredFormingCandles,
      failedEvents: this.failedEvents,
      lastEventAt: this.lastEventAt,
      lastPersistedAt:
        this.lastPersistedAt,
    };
  }

  private async processEvent(
    event: BinanceWebSocketKlineEvent,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        'Live candle service has not been initialized',
      );
    }

    const candle =
      mapClosedWebSocketKline(
        event,
        new Date(),
      );

    if (candle === null) {
      this.ignoredFormingCandles += 1;
      this.processedEvents += 1;

      return;
    }

    const assetId =
      this.assetIds.get(event.symbol);

    if (assetId === undefined) {
      throw new Error(
        `Asset ID is missing for ${event.symbol}`,
      );
    }

    const result =
      await this.repository.storeClosedCandles(
        assetId,
        event.symbol,
        [candle],
      );

    this.insertedCandles +=
      result.inserted;

    this.skippedCandles +=
      result.skipped;

    this.processedEvents += 1;
    this.lastPersistedAt = new Date();

    this.logger.info(
      {
        symbol: event.symbol,
        timeframe:
          event.kline.interval,
        openTime:
          candle.openTime.toISOString(),
        inserted: result.inserted,
        skipped: result.skipped,
      },
      'Live closed candle persisted',
    );
  }
}