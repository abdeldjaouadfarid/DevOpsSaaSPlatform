// DeploymentProcessor — BullMQ worker that walks a Deployment row
// through its lifecycle: PENDING → BUILDING → DEPLOYING → SUCCESS/FAILED.
//
// The pipeline steps are STUBBED for now (no real docker build, no git
// clone, no health-check curl). Each step just:
//   1. updates the row's status column,
//   2. appends a timestamped log line,
//   3. sleeps briefly to make the transitions visible from the UI.
//
// When we implement real steps in a later slice, only the bodies of
// transition/finish change; the orchestration around them stays.
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { FAIL_SENTINEL_COMMIT_SHA, QUEUE_NAMES } from '../queue.constants';
import type { RunDeploymentJobData } from './run-deployment.job';

// How long each stubbed step "takes". Real work will replace this
// with the actual build/deploy latency.
const STEP_DELAY_MS = 500;

/** Small helper — Promise-based setTimeout. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Append a new line (with ISO timestamp) to an existing logs blob.
 * Keeping logs as a single Text column for now; a future slice may
 * move them to object storage as they grow.
 */
const appendLog = (existing: string | null, line: string): string => {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  return existing ? `${existing}\n${stamped}` : stamped;
};

@Processor(QUEUE_NAMES.DEPLOYMENTS, { concurrency: 3 })
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * BullMQ calls this once per job. We reload the row from Postgres so
   * we always work against current state (row may have been deleted or
   * updated since the job was enqueued).
   *
   * On success, the row ends at SUCCESS with finishedAt set. On any
   * thrown error we:
   *   1. update the row to FAILED with the error message in logs,
   *   2. re-throw so BullMQ counts the attempt and (if attempts remain)
   *      schedules a retry with exponential backoff.
   *
   * NOTE: because we set FAILED inside catch{}, the row will briefly
   * show FAILED between attempts. That's intentional — the "final
   * outcome" is whatever the last attempt leaves in the row.
   */
  async process(job: Job<RunDeploymentJobData>): Promise<void> {
    const { deploymentId } = job.data;
    this.logger.log(`Processing deployment ${deploymentId} (attempt ${job.attemptsMade + 1})`);

    // Guard: bail if the row doesn't exist. Throwing here lets BullMQ
    // count the failed attempt; a follow-up DELETE-on-P2025 refinement
    // could stop retrying for a known-missing row.
    const deployment = await this.prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    try {
      // Step 1: pretend to build the image.
      await this.transition(deploymentId, DeploymentStatus.BUILDING, 'Building image…');
      await sleep(STEP_DELAY_MS);

      // Step 2: pretend to push/deploy the container.
      await this.transition(deploymentId, DeploymentStatus.DEPLOYING, 'Deploying container…');
      await sleep(STEP_DELAY_MS);

      // Test hook: caller can set commitSha=FAIL to force the failure
      // branch without hunting for a broken commit. Removed with real steps.
      if (deployment.commitSha === FAIL_SENTINEL_COMMIT_SHA) {
        throw new Error('Simulated failure (commitSha=FAIL)');
      }

      // Happy path — mark done.
      await this.finish(deploymentId, DeploymentStatus.SUCCESS, 'Deployment succeeded.');
    } catch (err) {
      // Failure path — record the reason, mark done, then rethrow so
      // BullMQ can retry.
      const message = err instanceof Error ? err.message : String(err);
      await this.finish(deploymentId, DeploymentStatus.FAILED, `ERROR: ${message}`);
      throw err;
    }
  }

  /**
   * Move a deployment to an intermediate status (BUILDING, DEPLOYING).
   * `finishedAt` stays null — this row is still in flight.
   */
  private async transition(
    deploymentId: string,
    status: DeploymentStatus,
    line: string,
  ): Promise<void> {
    // Re-read logs first so we append rather than overwrite. In a
    // higher-concurrency world we'd use a raw SQL append; for now the
    // extra round-trip is fine (single-worker per row anyway).
    const current = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
      select: { logs: true },
    });
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status, logs: appendLog(current.logs, line) },
    });
  }

  /**
   * Terminal-state update: sets status to SUCCESS or FAILED and stamps
   * finishedAt so downstream metrics ("how long did it take?") work.
   */
  private async finish(
    deploymentId: string,
    status: DeploymentStatus,
    line: string,
  ): Promise<void> {
    const current = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
      select: { logs: true },
    });
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status,
        finishedAt: new Date(),
        logs: appendLog(current.logs, line),
      },
    });
  }
}
