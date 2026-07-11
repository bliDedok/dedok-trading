import type { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@dedok/database';
import { serviceHealthSchema } from '@dedok/shared';

interface HealthOptions { prisma: PrismaClient; version: string }

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, options) => {
  app.get('/health', async (_request, reply) => {
    try {
      await options.prisma.$queryRaw`SELECT 1`;
      return serviceHealthSchema.parse({
        service: 'api', status: 'HEALTHY', timestamp: new Date().toISOString(),
        version: options.version, checks: { database: 'HEALTHY' },
      });
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Health database check failed');
      return reply.code(503).send(serviceHealthSchema.parse({
        service: 'api', status: 'DOWN', timestamp: new Date().toISOString(),
        version: options.version, checks: { database: 'DOWN' },
      }));
    }
  });
};
