// Central place for BullMQ queue and job identifiers used across the
// codebase. Keeping them here (instead of scattered string literals)
// means a typo shows up as a TypeScript error, not as a job that
// silently never gets processed.

/**
 * Named queues the app registers with BullMQ. Each corresponds to a
 * Redis key namespace.
 */
export const QUEUE_NAMES = {
  DEPLOYMENTS: 'deployments',
} as const;

/**
 * Named job types within each queue. Job type is separate from queue
 * name so a single queue can carry multiple job kinds later without
 * migrating Redis.
 */
export const JOB_NAMES = {
  RUN_DEPLOYMENT: 'run-deployment',
} as const;

/**
 * Sentinel commitSha value that the DeploymentProcessor treats as a
 * simulated failure. Used to exercise the FAILED path (and retries)
 * end-to-end from Swagger without needing real broken code.
 * Removed when the stubbed pipeline is replaced with real steps.
 */
export const FAIL_SENTINEL_COMMIT_SHA = 'FAIL';
