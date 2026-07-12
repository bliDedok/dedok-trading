import Fastify from 'fastify';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  signalRoutes,
} from '../src/routes/signals.js';
import type {
  LatestSignalService,
} from '../src/services/latest-signal-service.js';

describe(
  'signal routes',
  () => {
    const apps:
      Array<
        ReturnType<
          typeof Fastify
        >
      > = [];

    afterEach(async () => {
      await Promise.all(
        apps.map((app) =>
          app.close(),
        ),
      );

      apps.length = 0;
    });

    it('returns the latest signal', async () => {
      const service = {
        getLatest:
          vi.fn()
            .mockResolvedValue({
              symbol:
                'BTCUSDT',
              timeframe:
                '15m',
              candleCount: 300,
              signal: {
                signal: 'SHORT',
                confidence: 75,
                bullishScore: 10,
                bearishScore: 85,
                evaluatedAt:
                  new Date(
                    '2026-07-12T06:00:00.000Z',
                  ),
                candleCloseTime:
                  new Date(
                    '2026-07-12T05:44:59.999Z',
                  ),
                reasons: [
                  'Close is below SMA 50',
                ],
                rules: [
                  {
                    id:
                      'price-vs-sma',
                    label:
                      'Price versus slow SMA',
                    direction:
                      'BEARISH',
                    score: 20,
                    reason:
                      'Close is below SMA 50',
                  },
                ],
              },
            }),
      } as unknown as
        LatestSignalService;

      const app = Fastify();

      apps.push(app);

      await app.register(
        signalRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/signals/latest' +
            '?symbol=BTCUSDT' +
            '&timeframe=15m' +
            '&historyLimit=300',
        });

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        response.json(),
      ).toEqual({
        data: {
          symbol:
            'BTCUSDT',
          timeframe:
            '15m',
          candleCount: 300,
          signal: 'SHORT',
          confidence: 75,
          bullishScore: 10,
          bearishScore: 85,
          evaluatedAt:
            '2026-07-12T06:00:00.000Z',
          candleCloseTime:
            '2026-07-12T05:44:59.999Z',
          reasons: [
            'Close is below SMA 50',
          ],
          rules: [
            {
              id:
                'price-vs-sma',
              label:
                'Price versus slow SMA',
              direction:
                'BEARISH',
              score: 20,
              reason:
                'Close is below SMA 50',
            },
          ],
        },
      });
    });

    it('returns 404 when candle data is unavailable', async () => {
      const service = {
        getLatest:
          vi.fn()
            .mockResolvedValue(
              null,
            ),
      } as unknown as
        LatestSignalService;

      const app = Fastify();

      apps.push(app);

      await app.register(
        signalRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/signals/latest' +
            '?symbol=SOLUSDT' +
            '&timeframe=4h',
        });

      expect(
        response.statusCode,
      ).toBe(404);

      expect(
        response.json(),
      ).toEqual({
        error: {
          code:
            'SIGNAL_DATA_NOT_FOUND',
          message:
            'No closed candles found for SOLUSDT 4h',
        },
      });
    });

    it('returns 400 for an invalid query', async () => {
      const service = {
        getLatest:
          vi.fn(),
      } as unknown as
        LatestSignalService;

      const app = Fastify();

      apps.push(app);

      await app.register(
        signalRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/signals/latest' +
            '?symbol=INVALID' +
            '&timeframe=15m',
        });

      expect(
        response.statusCode,
      ).toBe(400);

      expect(
        response.json()
          .error.code,
      ).toBe(
        'INVALID_SIGNAL_QUERY',
      );

      expect(
        service.getLatest,
      ).not.toHaveBeenCalled();
    });
  },
);