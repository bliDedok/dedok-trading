import type {
  FastifyPluginAsync,
} from 'fastify';

import {
  latestIndicatorQuerySchema,
} from '@dedok/shared';

import type {
  LatestIndicatorService,
} from '../services/latest-indicator-service.js';

export interface IndicatorRoutesOptions {
  service: LatestIndicatorService;
}

export const indicatorRoutes:
  FastifyPluginAsync<
    IndicatorRoutesOptions
  > = async (
    app,
    options,
  ) => {
    app.get(
      '/api/indicators/latest',
      async (
        request,
        reply,
      ) => {
        const parsed =
          latestIndicatorQuerySchema.safeParse(
            request.query,
          );

        if (!parsed.success) {
          return reply
            .status(400)
            .send({
              error: {
                code:
                  'INVALID_INDICATOR_QUERY',
                message:
                  'Invalid indicator query parameters',
                details:
                  parsed.error.flatten(),
              },
            });
        }

        const {
          symbol,
          timeframe,
          historyLimit,
        } = parsed.data;

        const result =
          await options.service.getLatest(
            symbol,
            timeframe,
            historyLimit,
          );

        if (result === null) {
          return reply
            .status(404)
            .send({
              error: {
                code:
                  'INDICATOR_DATA_NOT_FOUND',
                message:
                  `No closed candles found for ${symbol} ${timeframe}`,
              },
            });
        }

        return reply.send({
          data: {
            symbol:
              result.symbol,
            timeframe:
              result.timeframe,
            candleCount:
              result.candleCount,
            snapshot: {
              calculatedAt:
                result.snapshot
                  .calculatedAt
                  .toISOString(),
              candleOpenTime:
                result.snapshot
                  .candleOpenTime
                  .toISOString(),
              candleCloseTime:
                result.snapshot
                  .candleCloseTime
                  .toISOString(),
              close:
                result.snapshot.close,
              sma:
                result.snapshot.sma,
              ema:
                result.snapshot.ema,
              rsi:
                result.snapshot.rsi,
              atr:
                result.snapshot.atr,
              macd:
                result.snapshot.macd,
              bollingerBands:
                result.snapshot
                  .bollingerBands,
            },
          },
        });
      },
    );
  };