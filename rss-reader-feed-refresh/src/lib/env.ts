import { z } from 'zod';

const envSchema = z.object({
  HOST: z.string().default('::'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
