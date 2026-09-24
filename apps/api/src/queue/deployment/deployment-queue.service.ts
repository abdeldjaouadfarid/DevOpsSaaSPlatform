// DeploymentQueueService — thin helper that hides BullMQ's Queue API
// behind a single enqueue() call.
//
// Why wrap it: callers (DeploymentsService, the future webhook module)
// shouldn't need to know about job names, retry policy, or the payload
// shape. If we ever change any of that, we change one file.
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../queue.constants';
import type { RunDeploymentJobData } from './run-deployment.job';

@Injectable()
export class DeploymentQueueService {
  constructor(
    // @InjectQueue asks the BullMQ module for the named queue's Queue
    // client; the generic parameter narrows the payload type so
    // queue.add() is type-checked against the job payload interface.
    @InjectQueue(QUEUE_NAMES.DEPLOYMENTS)
    private readonly queue: Queue<RunDeploymentJobData>,
  ) {}

  /**
   * Enqueue a run-deployment job.
   *
   * Retry policy:
   *   attempts: 3 — one initial try + two retries
   *   backoff: exponential starting at 1s — subsequent retries at 2s, 4s
   * This is small enough that a flapping infra hiccup gets a chance to
   * recover, but not so long that a permanent failure lingers.
   */
  enqueue(deploymentId: string): Promise<Job<RunDeploymentJobData>> {
    return this.queue.add(
      JOB_NAMES.RUN_DEPLOYMENT,
      { deploymentId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }
}
