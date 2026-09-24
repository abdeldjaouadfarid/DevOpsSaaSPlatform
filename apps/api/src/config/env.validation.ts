// Runtime validation of every environment variable the API reads.
//
// Zod parses process.env into a typed object; ConfigModule calls
// validateEnv() during boot (see app.module.ts) and refuses to start if
// anything is missing or malformed. That converts "silent misconfiguration
// bug" into "immediate boot failure with a clear message".
import { z } from 'zod';

/**
 * Shared parser for booleans stored as the strings "true"/"false" in .env.
 * Returns undefined when the var is unset (so callers can decide the
 * default themselves based on other signals like NODE_ENV).
 */
const optionalBool = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

/**
 * Schema for every env var the API cares about. Values used by NestJS
 * modules should be looked up via ConfigService with the same keys.
 */
export const envSchema = z.object({
  // Standard Node convention; drives dev-only conveniences like Swagger.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // API listen port. `coerce` converts the raw string from process.env.
  PORT: z.coerce.number().int().positive().default(3000),
  // Postgres connection string used by Prisma (schema.prisma reads env()).
  DATABASE_URL: z.string().url(),
  // JWT signing key. 32-char minimum matches HS256 recommended entropy.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // How long an access token is valid (Nest's JwtModule accepts these strings).
  JWT_EXPIRES_IN: z.string().default('1h'),
  // Origin the future dashboard will run on; used by app.enableCors.
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Redis connection details for BullMQ.
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  // Feature toggles — undefined means "let NODE_ENV decide".
  SWAGGER_ENABLED: optionalBool,
  BULL_BOARD_ENABLED: optionalBool,
});

// Inferred TypeScript type of the parsed env. Prefer this over reading
// process.env directly so callers get full type safety.
export type Env = z.infer<typeof envSchema>;

/**
 * Called by ConfigModule.forRoot({ validate }) during boot.
 * Throws with a human-readable list of every problem instead of stopping
 * at the first error — makes fixing a broken .env one iteration instead
 * of five.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
