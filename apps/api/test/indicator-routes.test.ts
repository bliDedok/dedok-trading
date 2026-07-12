import Fastify from 'fastify';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  indicatorRoutes,
} from '../src/routes/indicators.js';
import type {
  LatestIndicatorService,
} from '../src/services/latest-indicator-service.js';

describe(
  'indicator routes',
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

    it('returns the latest indicator snapshot', async () => {
      const service = {
        getLatest:
          vi.fn()
            .mockResolvedValue({
              symbol:
                'BTCUSDT',
              timeframe:
                '15m',
              candleCount: 300,
              snapshot: {
                calculatedAt:
                  new Date(
                    '2026-07-12T06:00:00.000Z',
                  ),
                candleOpenTime:
                  new Date(
                    '2026-07-12T05:30:00.000Z',
                  ),
                candleCloseTime:
                  new Date(
                    '2026-07-12T05:44:59.999Z',
                  ),
                close: 64025.17,
                sma: {
                  '20': 63980,
                },
                ema: {
                  '9': 64010,
                },
                rsi: {
                  '14': 61.2,
                },
                atr: {
                  '14': 185.4,
                },
                macd: {
                  macd: 12.5,
                  signal: 10.2,
                  histogram: 2.3,
                },
                bollingerBands: {
                  middle: 63980,
                  upper: 64250,
                  lower: 63710,
                },
              },
            }),
      } as unknown as
        LatestIndicatorService;

      const app =
        Fastify();

      apps.push(app);

      await app.register(
        indicatorRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/indicators/latest' +
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
          snapshot: {
            calculatedAt:
              '2026-07-12T06:00:00.000Z',
            candleOpenTime:
              '2026-07-12T05:30:00.000Z',
            candleCloseTime:
              '2026-07-12T05:44:59.999Z',
            close: 64025.17,
            sma: {
              '20': 63980,
            },
            ema: {
              '9': 64010,
            },
            rsi: {
              '14': 61.2,
            },
            atr: {
              '14': 185.4,
            },
            macd: {
              macd: 12.5,
              signal: 10.2,
              histogram: 2.3,
            },
            bollingerBands: {
              middle: 63980,
              upper: 64250,
              lower: 63710,
            },
          },
        },
      });
    });

    it('returns 404 when no candles exist', async () => {
      const service = {
        getLatest:
          vi.fn()
            .mockResolvedValue(
              null,
            ),
      } as unknown as
        LatestIndicatorService;

      const app =
        Fastify();

      apps.push(app);

      await app.register(
        indicatorRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/indicators/latest' +
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
            'INDICATOR_DATA_NOT_FOUND',
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
        LatestIndicatorService;

      const app =
        Fastify();

      apps.push(app);

      await app.register(
        indicatorRoutes,
        {
          service,
        },
      );

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/indicators/latest' +
            '?symbol=INVALID' +
            '&timeframe=15m',
        });

      expect(
        response.statusCode,
      ).toBe(400);

      expect(
        response.json().error.code,
      ).toBe(
        'INVALID_INDICATOR_QUERY',
      );

      expect(
        service.getLatest,
      ).not.toHaveBeenCalled();
    });
  },
);