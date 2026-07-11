import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { PrismaClient } from '@dedok/database';

const env = { NODE_ENV: 'test', LOG_LEVEL: 'silent', API_HOST: '127.0.0.1', API_PORT: 4000, DATABASE_URL: 'postgresql://user:pass@localhost:5432/test', CORS_ORIGINS: 'http://localhost:3000' } as const;

describe('GET /health', () => {
  it('returns healthy when database responds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaClient;
    const app = await buildApp({ env, prisma });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: 'api', status: 'HEALTHY', checks: { database: 'HEALTHY' } });
    await app.close();
  });

  it('returns 503 when database fails', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as PrismaClient;
    const app = await buildApp({ env, prisma });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'DOWN', checks: { database: 'DOWN' } });
    await app.close();
  });
});
