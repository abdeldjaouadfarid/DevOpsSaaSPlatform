// Ensures e2e specs never accidentally hit the dev database.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ??
    'postgresql://devops:devops@localhost:5434/devops_saas_test?schema=public';
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-secret-please-change-and-be-at-least-32-chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.PORT = process.env.PORT ?? '0';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
// Keep Bull Board off during e2e — it mounts routes on the Express app and we don't need it.
process.env.BULL_BOARD_ENABLED = 'false';
