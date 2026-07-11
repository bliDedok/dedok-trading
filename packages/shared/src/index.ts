import { z } from 'zod';

export const healthStatusSchema = z.enum(['HEALTHY', 'DEGRADED', 'DOWN']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const serviceHealthSchema = z.object({
  service: z.string().min(1),
  status: healthStatusSchema,
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  checks: z.record(z.string(), z.unknown()).default({}),
});
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
