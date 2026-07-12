import type {
  BinanceWebSocketHealth,
} from '../market-data/binance-websocket-client.js';

export type MarketDataHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN';

export interface MarketDataStaleResult {
  status: MarketDataHealthStatus;
  stale: boolean;
  messageAgeMs: number | null;
  reason:
    | 'STREAM_HEALTHY'
    | 'NO_MESSAGE_RECEIVED'
    | 'MESSAGE_STALE'
    | 'SOCKET_CONNECTING'
    | 'SOCKET_RECONNECTING'
    | 'SOCKET_STOPPED';
}

export class MarketDataStaleDetector {
  public constructor(
    private readonly staleAfterMs: number,
  ) {
    if (
      !Number.isInteger(staleAfterMs) ||
      staleAfterMs < 1_000
    ) {
      throw new RangeError(
        'Market stale threshold must be at least 1000ms',
      );
    }
  }

  public evaluate(
    health: BinanceWebSocketHealth,
    now: Date = new Date(),
  ): MarketDataStaleResult {
    if (
      health.status === 'STOPPED' ||
      health.status === 'IDLE'
    ) {
      return {
        status: 'DOWN',
        stale: true,
        messageAgeMs: null,
        reason: 'SOCKET_STOPPED',
      };
    }

    if (health.status === 'CONNECTING') {
      return {
        status: 'DEGRADED',
        stale: false,
        messageAgeMs: null,
        reason: 'SOCKET_CONNECTING',
      };
    }

    if (
      health.status === 'RECONNECTING'
    ) {
      return {
        status: 'DEGRADED',
        stale: true,
        messageAgeMs:
          this.calculateAge(
            health.lastMessageAt,
            now,
          ),
        reason: 'SOCKET_RECONNECTING',
      };
    }

    if (health.lastMessageAt === null) {
      return {
        status: 'DEGRADED',
        stale: false,
        messageAgeMs: null,
        reason: 'NO_MESSAGE_RECEIVED',
      };
    }

    const messageAgeMs =
      Math.max(
        now.getTime() -
          health.lastMessageAt.getTime(),
        0,
      );

    if (
      messageAgeMs >
      this.staleAfterMs
    ) {
      return {
        status: 'DEGRADED',
        stale: true,
        messageAgeMs,
        reason: 'MESSAGE_STALE',
      };
    }

    return {
      status: 'HEALTHY',
      stale: false,
      messageAgeMs,
      reason: 'STREAM_HEALTHY',
    };
  }

  private calculateAge(
    timestamp: Date | null,
    now: Date,
  ): number | null {
    if (timestamp === null) {
      return null;
    }

    return Math.max(
      now.getTime() -
        timestamp.getTime(),
      0,
    );
  }
}