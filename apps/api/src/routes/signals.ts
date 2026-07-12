import {
  latestSignalQuerySchema,
} from '@dedok/shared';
import type {
  FastifyPluginAsync,
} from 'fastify';

import type {
  LatestSignalService,
} from '../services/latest-signal-service.js';

export interface SignalRoutesOptions {
  service: LatestSignalService;
}

export const signalRoutes:
  FastifyPluginAsync<
    SignalRoutesOptions
  > = async (
    app,
    options,
  ) => {
    app.get(
      '/api/signals/latest',
      async (
        request,
        reply,
      ) => {
        const parsed =
          latestSignalQuerySchema.safeParse(
            request.query,
          );

        if (!parsed.success) {
          return reply
            .status(400)
            .send({
              error: {
                code:
                  'INVALID_SIGNAL_QUERY',
                message:
                  'Invalid signal query parameters',
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
                  'SIGNAL_DATA_NOT_FOUND',
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
            signal:
              result.signal.signal,
            confidence:
              result.signal.confidence,
            bullishScore:
              result.signal
                .bullishScore,
            bearishScore:
              result.signal
                .bearishScore,
            evaluatedAt:
              result.signal
                .evaluatedAt
                .toISOString(),
            candleCloseTime:
              result.signal
                .candleCloseTime
                .toISOString(),
            reasons:
              result.signal.reasons,
            rules:
              result.signal.rules,
          },
        });
      },
    );
  };