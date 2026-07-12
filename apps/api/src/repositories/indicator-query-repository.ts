import type {
  PrismaClient,
} from '@dedok/database';
import type {
  IndicatorCandle,
} from '@dedok/indicators';
import {
  timeframeToDatabase,
  type SupportedSymbol,
  type SupportedTimeframe,
} from '@dedok/shared';

export interface IndicatorQueryRepositoryContract {
  listClosedCandles(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
    limit: number,
  ): Promise<IndicatorCandle[]>;
}

export class IndicatorQueryRepository
  implements
    IndicatorQueryRepositoryContract
{
  public constructor(
    private readonly prisma:
      PrismaClient,
  ) {}

  public async listClosedCandles(
    symbol: SupportedSymbol,
    timeframe: SupportedTimeframe,
    limit: number,
  ): Promise<IndicatorCandle[]> {
    const rows =
      await this.prisma.candle.findMany({
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
        take: limit,
        select: {
          openTime: true,
          closeTime: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
      });

    return rows
      .map((row) => ({
        openTime: row.openTime,
        closeTime: row.closeTime,
        open: toFiniteNumber(
          row.open.toString(),
          'open',
        ),
        high: toFiniteNumber(
          row.high.toString(),
          'high',
        ),
        low: toFiniteNumber(
          row.low.toString(),
          'low',
        ),
        close: toFiniteNumber(
          row.close.toString(),
          'close',
        ),
        volume: toFiniteNumber(
          row.volume.toString(),
          'volume',
        ),
      }))
      .reverse();
  }
}

function toFiniteNumber(
  value: string,
  field: string,
): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(
      `Invalid candle ${field} value: ${value}`,
    );
  }

  return numericValue;
}