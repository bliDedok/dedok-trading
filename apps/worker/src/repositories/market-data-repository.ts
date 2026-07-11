import type { PrismaClient } from '@dedok/database';
import {
  timeframeToDatabase,
  type CandleInput,
  type SupportedSymbol,
} from '@dedok/shared';

import type { AssetDefinition } from '../market-data/assets.js';

export interface AssetRecord {
  id: string;
  symbol: SupportedSymbol;
}

export interface StoreCandlesResult {
  received: number;
  inserted: number;
  skipped: number;
}

export interface MarketDataRepositoryContract {
  upsertAssets(
    assets: readonly AssetDefinition[],
  ): Promise<Map<SupportedSymbol, string>>;

  storeClosedCandles(
    assetId: string,
    symbol: SupportedSymbol,
    candles: readonly CandleInput[],
  ): Promise<StoreCandlesResult>;
}

export class MarketDataValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MarketDataValidationError';
  }
}

export function assertClosedCandles(
  expectedSymbol: SupportedSymbol,
  candles: readonly CandleInput[],
): void {
  for (const candle of candles) {
    if (!candle.isClosed) {
      throw new MarketDataValidationError(
        `Refusing to persist an open candle for ${candle.symbol} ${candle.timeframe}`,
      );
    }

    if (candle.symbol !== expectedSymbol) {
      throw new MarketDataValidationError(
        `Candle symbol ${candle.symbol} does not match expected symbol ${expectedSymbol}`,
      );
    }

    if (candle.closeTime <= candle.openTime) {
      throw new MarketDataValidationError(
        `Candle closeTime must be after openTime for ${candle.symbol} ${candle.timeframe}`,
      );
    }
  }
}

export function buildCandleCreateManyData(
  assetId: string,
  expectedSymbol: SupportedSymbol,
  candles: readonly CandleInput[],
) {
  assertClosedCandles(expectedSymbol, candles);

  return candles.map((candle) => ({
    assetId,
    symbol: candle.symbol,
    timeframe: timeframeToDatabase[candle.timeframe],
    source: 'BINANCE' as const,
    openTime: candle.openTime,
    closeTime: candle.closeTime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    quoteVolume: candle.quoteVolume,
    tradeCount: candle.tradeCount,
    takerBuyBaseVolume: candle.takerBuyBaseVolume,
    takerBuyQuoteVolume: candle.takerBuyQuoteVolume,
    isClosed: true,
    receivedAt: candle.receivedAt,
  }));
}

export class MarketDataRepository
  implements MarketDataRepositoryContract
{
  public constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async upsertAssets(
    assets: readonly AssetDefinition[],
  ): Promise<Map<SupportedSymbol, string>> {
    if (assets.length === 0) {
      return new Map<SupportedSymbol, string>();
    }

    const records = await this.prisma.$transaction(
      assets.map((asset) =>
        this.prisma.asset.upsert({
          where: {
            symbol: asset.symbol,
          },
          create: {
            symbol: asset.symbol,
            baseAsset: asset.baseAsset,
            quoteAsset: asset.quoteAsset,
            status: 'ACTIVE',
            pricePrecision: asset.pricePrecision,
            quantityPrecision:
              asset.quantityPrecision,
            minQuantity: asset.minQuantity,
            stepSize: asset.stepSize,
            minNotional: asset.minNotional,
          },
          update: {
            baseAsset: asset.baseAsset,
            quoteAsset: asset.quoteAsset,
            status: 'ACTIVE',
            pricePrecision: asset.pricePrecision,
            quantityPrecision:
              asset.quantityPrecision,
            minQuantity: asset.minQuantity,
            stepSize: asset.stepSize,
            minNotional: asset.minNotional,
          },
          select: {
            id: true,
            symbol: true,
          },
        }),
      ),
    );

    const assetIds =
      new Map<SupportedSymbol, string>();

    for (const record of records) {
      if (
        record.symbol !== 'BTCUSDT' &&
        record.symbol !== 'ETHUSDT' &&
        record.symbol !== 'SOLUSDT'
      ) {
        throw new MarketDataValidationError(
          `Database returned unsupported symbol ${record.symbol}`,
        );
      }

      assetIds.set(record.symbol, record.id);
    }

    return assetIds;
  }

  public async storeClosedCandles(
    assetId: string,
    symbol: SupportedSymbol,
    candles: readonly CandleInput[],
  ): Promise<StoreCandlesResult> {
    if (!assetId.trim()) {
      throw new MarketDataValidationError(
        'assetId must not be empty',
      );
    }

    if (candles.length === 0) {
      return {
        received: 0,
        inserted: 0,
        skipped: 0,
      };
    }

    const data = buildCandleCreateManyData(
      assetId,
      symbol,
      candles,
    );

    const result =
      await this.prisma.candle.createMany({
        data,
        skipDuplicates: true,
      });

    return {
      received: candles.length,
      inserted: result.count,
      skipped: candles.length - result.count,
    };
  }
}