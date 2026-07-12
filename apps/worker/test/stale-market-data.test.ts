import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  BinanceWebSocketHealth,
} from '../src/market-data/binance-websocket-client.js';
import {
  MarketDataStaleDetector,
} from '../src/services/stale-market-data.js';

function createHealth(
  overrides: Partial<BinanceWebSocketHealth> = {},
): BinanceWebSocketHealth {
  return {
    status: 'CONNECTED',
    connected: true,
    reconnectAttempt: 0,
    lastMessageAt: new Date(
      '2026-01-01T00:00:09.000Z',
    ),
    lastPongAt: new Date(
      '2026-01-01T00:00:09.000Z',
    ),
    awaitingPong: false,
    ...overrides,
  };
}

describe(
  'MarketDataStaleDetector',
  () => {
    const detector =
      new MarketDataStaleDetector(5_000);

    it('reports a healthy stream', () => {
      const result = detector.evaluate(
        createHealth(),
        new Date(
          '2026-01-01T00:00:10.000Z',
        ),
      );

      expect(result).toEqual({
        status: 'HEALTHY',
        stale: false,
        messageAgeMs: 1_000,
        reason: 'STREAM_HEALTHY',
      });
    });

    it('reports a stale stream', () => {
      const result = detector.evaluate(
        createHealth({
          lastMessageAt: new Date(
            '2026-01-01T00:00:01.000Z',
          ),
        }),
        new Date(
          '2026-01-01T00:00:10.000Z',
        ),
      );

      expect(result).toMatchObject({
        status: 'DEGRADED',
        stale: true,
        messageAgeMs: 9_000,
        reason: 'MESSAGE_STALE',
      });
    });

    it('reports reconnecting as degraded', () => {
      const result = detector.evaluate(
        createHealth({
          status: 'RECONNECTING',
          connected: false,
        }),
      );

      expect(result.status).toBe(
        'DEGRADED',
      );

      expect(result.stale).toBe(true);
    });

    it('reports stopped as down', () => {
      const result = detector.evaluate(
        createHealth({
          status: 'STOPPED',
          connected: false,
        }),
      );

      expect(result).toMatchObject({
        status: 'DOWN',
        stale: true,
        reason: 'SOCKET_STOPPED',
      });
    });

    it('reports no first message as degraded', () => {
      const result = detector.evaluate(
        createHealth({
          lastMessageAt: null,
        }),
      );

      expect(result).toEqual({
        status: 'DEGRADED',
        stale: false,
        messageAgeMs: null,
        reason:
          'NO_MESSAGE_RECEIVED',
      });
    });
  },
);