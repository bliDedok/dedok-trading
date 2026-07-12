import {
  apiErrorSchema,
  latestCandleQuerySchema,
  latestCandleResponseSchema,
  marketAssetsResponseSchema,
  marketCandlesQuerySchema,
  marketCandlesResponseSchema,
  marketHealthResponseSchema,
} from '@dedok/shared';
import type {
  FastifyPluginAsync,
} from 'fastify';

import type {
  MarketQueryRepositoryContract,
} from '../repositories/market-query-repository.js';
import {
  MarketHealthService,
} from '../services/market-health-service.js';

interface MarketRouteOptions {
  repository:
    MarketQueryRepositoryContract;
}

export const marketRoutes:
  FastifyPluginAsync<
    MarketRouteOptions
  > = async (app, options) => {
    const healthService =
      new MarketHealthService(
        options.repository,
      );

    app.get('/api/assets', async () => {
      const data =
        await options.repository.listAssets();

      return marketAssetsResponseSchema.parse({
        data,
      });
    });

    app.get(
      '/api/candles',
      async (request, reply) => {
        const queryResult =
          marketCandlesQuerySchema.safeParse(
            request.query,
          );

        if (!queryResult.success) {
          return reply.code(400).send(
            apiErrorSchema.parse({
              error: {
                code: 'INVALID_QUERY',
                message:
                  'Invalid market candle query',
                requestId: request.id,
              },
            }),
          );
        }

        const page =
          await options.repository.listCandles(
            queryResult.data,
          );

        return marketCandlesResponseSchema.parse(
          page,
        );
      },
    );

    app.get(
      '/api/candles/latest',
      async (request, reply) => {
        const queryResult =
          latestCandleQuerySchema.safeParse(
            request.query,
          );

        if (!queryResult.success) {
          return reply.code(400).send(
            apiErrorSchema.parse({
              error: {
                code: 'INVALID_QUERY',
                message:
                  'Invalid latest candle query',
                requestId: request.id,
              },
            }),
          );
        }

        const candle =
          await options.repository.getLatestCandle(
            queryResult.data.symbol,
            queryResult.data.timeframe,
          );

        if (candle === null) {
          return reply.code(404).send(
            apiErrorSchema.parse({
              error: {
                code: 'CANDLE_NOT_FOUND',
                message:
                  'Latest candle was not found',
                requestId: request.id,
              },
            }),
          );
        }

        return latestCandleResponseSchema.parse({
          data: candle,
        });
      },
    );

    app.get(
      '/api/market/health',
      async () => {
        const health =
          await healthService.evaluate();

        return marketHealthResponseSchema.parse(
          health,
        );
      },
    );
  };