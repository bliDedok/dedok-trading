import type { PrismaClient } from '@dedok/database';
import {
  databaseToTimeframe,
  symbolSchema,
  timeframeToDatabase,
  type MarketCandlesQuery,
  type SupportedSymbol,
  type SupportedTimeframe,
} from '@dedok/shared';

export interface MarketAssetDto {
  symbol: SupportedSymbol;
  baseAsset: string;
  quoteAsset: string;
  status: 'ACTIVE' | 'INACTIVE';
  latestCandleTime: string | null;
}

export interface MarketCandleDto {
  id: string;
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  source: 'BINANCE';
  openTime: string;
  closeTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  tradeCount: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
  isClosed: true;
  receivedAt: string;
}

export interface MarketCandlePage {
  data: MarketCandleDto[];
  pagination: {
    limit: number;
    nextBefore: string | null;
    hasMore: boolean;
  };
}

export interface LatestCandleTimeDto {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  closeTime: string;
}

export interface MarketQueryRepositoryContract {
  listAssets(): Promise<MarketAssetDto[]>;

  listCandles(
    query: MarketCandlesQuery,
  ): Promise<MarketCandlePage>;

  getLatestCandle(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
  ): Promise<MarketCandleDto | null>;

  listLatestCandleTimes(): Promise<
    LatestCandleTimeDto[]
  >;
}

export class MarketQueryRepository
  implements MarketQueryRepositoryContract
{
  public constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async listAssets(): Promise<
    MarketAssetDto[]
  > {
    const assets =
      await this.prisma.asset.findMany({
        orderBy: {
          symbol: 'asc',
        },
        select: {
          symbol: true,
          baseAsset: true,
          quoteAsset: true,
          status: true,
          candles: {
            where: {
              isClosed: true,
            },
            orderBy: {
              closeTime: 'desc',
            },
            take: 1,
            select: {
              closeTime: true,
            },
          },
        },
      });

    return assets.map((asset) => ({
      symbol: symbolSchema.parse(
        asset.symbol,
      ),
      baseAsset: asset.baseAsset,
      quoteAsset: asset.quoteAsset,
      status: asset.status,
      latestCandleTime:
        asset.candles[0]?.closeTime.toISOString() ??
        null,
    }));
  }

  public async listCandles(
    query: MarketCandlesQuery,
  ): Promise<MarketCandlePage> {
    const timeframe =
      timeframeToDatabase[
        query.timeframe
      ];

    const rows =
      await this.prisma.candle.findMany({
        where: {
          symbol: query.symbol,
          timeframe,
          isClosed: true,
          ...(query.before === undefined
            ? {}
            : {
                openTime: {
                  lt: new Date(
                    query.before,
                  ),
                },
              }),
        },
        orderBy: {
          openTime: 'desc',
        },
        take: query.limit + 1,
        select: {
          id: true,
          symbol: true,
          timeframe: true,
          source: true,
          openTime: true,
          closeTime: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
          quoteVolume: true,
          tradeCount: true,
          takerBuyBaseVolume: true,
          takerBuyQuoteVolume: true,
          isClosed: true,
          receivedAt: true,
        },
      });

    const hasMore =
      rows.length > query.limit;

    const pageRows = rows.slice(
      0,
      query.limit,
    );

    const data = pageRows.map((row) =>
      this.mapCandle(row),
    );

    return {
      data,
      pagination: {
        limit: query.limit,
        hasMore,
        nextBefore:
          hasMore && data.length > 0
            ? data[
                data.length - 1
              ]?.openTime ?? null
            : null,
      },
    };
  }

  public async getLatestCandle(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
  ): Promise<MarketCandleDto | null> {
    const row =
      await this.prisma.candle.findFirst({
        where: {
          symbol,
          timeframe:
            timeframeToDatabase[
              timeframe
            ],
          isClosed: true,
        },
        orderBy: {
          openTime: 'desc',
        },
        select: {
          id: true,
          symbol: true,
          timeframe: true,
          source: true,
          openTime: true,
          closeTime: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
          quoteVolume: true,
          tradeCount: true,
          takerBuyBaseVolume: true,
          takerBuyQuoteVolume: true,
          isClosed: true,
          receivedAt: true,
        },
      });

    return row === null
      ? null
      : this.mapCandle(row);
  }

  public async listLatestCandleTimes(): Promise<
    LatestCandleTimeDto[]
  > {
    const rows =
      await this.prisma.candle.groupBy({
        by: [
          'symbol',
          'timeframe',
        ],
        where: {
          isClosed: true,
        },
        _max: {
          closeTime: true,
        },
        orderBy: [
          {
            symbol: 'asc',
          },
          {
            timeframe: 'asc',
          },
        ],
      });

    return rows.flatMap((row) => {
      const closeTime =
        row._max.closeTime;

      if (closeTime === null) {
        return [];
      }

      return [
        {
          symbol: symbolSchema.parse(
            row.symbol,
          ),
          timeframe:
            databaseToTimeframe[
              row.timeframe
            ],
          closeTime:
            closeTime.toISOString(),
        },
      ];
    });
  }

  private mapCandle(
    row: {
      id: string;
      symbol: string;
      timeframe:
        | 'M15'
        | 'H1'
        | 'H4'
        | 'D1';
      source: 'BINANCE';
      openTime: Date;
      closeTime: Date;
      open: {
        toString(): string;
      };
      high: {
        toString(): string;
      };
      low: {
        toString(): string;
      };
      close: {
        toString(): string;
      };
      volume: {
        toString(): string;
      };
      quoteVolume: {
        toString(): string;
      };
      tradeCount: number;
      takerBuyBaseVolume: {
        toString(): string;
      };
      takerBuyQuoteVolume: {
        toString(): string;
      };
      isClosed: boolean;
      receivedAt: Date;
    },
  ): MarketCandleDto {
    if (!row.isClosed) {
      throw new Error(
        `Expected closed candle ${row.id}`,
      );
    }

    return {
      id: row.id,
      symbol: symbolSchema.parse(
        row.symbol,
      ),
      timeframe:
        databaseToTimeframe[
          row.timeframe
        ],
      source: row.source,
      openTime:
        row.openTime.toISOString(),
      closeTime:
        row.closeTime.toISOString(),
      open: row.open.toString(),
      high: row.high.toString(),
      low: row.low.toString(),
      close: row.close.toString(),
      volume: row.volume.toString(),
      quoteVolume:
        row.quoteVolume.toString(),
      tradeCount: row.tradeCount,
      takerBuyBaseVolume:
        row.takerBuyBaseVolume.toString(),
      takerBuyQuoteVolume:
        row.takerBuyQuoteVolume.toString(),
      isClosed: true,
      receivedAt:
        row.receivedAt.toISOString(),
    };
  }
}