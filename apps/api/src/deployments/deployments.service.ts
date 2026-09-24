// DeploymentsService — read paths for deployments and the write path
// that kicks the BullMQ pipeline off.
//
// All operations verify the caller owns the parent project (via
// assertProjectOwned) and return 404 on any ownership mismatch so
// existence of foreign resources isn't leaked.
import { Injectable, NotFoundException } from '@nestjs/common';
import { Deployment, DeploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentQueueService } from '../queue/deployment/deployment-queue.service';

// Client-supplied `limit` is clamped to this range so callers can't
// force us to page through the entire deployment history in one request.
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DeploymentQueueService,
  ) {}

  /**
   * List deployments for a project the caller owns, newest first.
   * Ownership is checked before hitting the deployments table so
   * unauthorized users get 404 without confirming the project exists.
   */
  async listForProject(ownerId: string, projectId: string, limit = DEFAULT_LIMIT) {
    const cap = Math.min(Math.max(1, limit), MAX_LIMIT);
    await this.assertProjectOwned(ownerId, projectId);
    return this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: cap,
    });
  }

  /**
   * Fetch one deployment. The `project: { ownerId }` filter both
   * enforces ownership AND avoids a separate lookup — Prisma joins to
   * project and filters in one query.
   */
  async findOne(ownerId: string, id: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, project: { ownerId } },
    });
    if (!deployment) throw new NotFoundException();
    return deployment;
  }

  /**
   * Kick off a new deployment.
   *
   * 1. Verify the caller owns the project (404 otherwise).
   * 2. Create a Deployment row in PENDING status — this is the audit
   *    trail that will be updated by the worker as it advances.
   * 3. Enqueue a BullMQ job carrying only the deploymentId — the worker
   *    reloads the row so it always sees current state.
   * 4. Return the freshly-created row so the caller has an id to poll
   *    without a separate GET.
   */
  async trigger(ownerId: string, projectId: string, commitSha?: string): Promise<Deployment> {
    await this.assertProjectOwned(ownerId, projectId);
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        commitSha: commitSha ?? null,
        status: DeploymentStatus.PENDING,
      },
    });
    await this.queue.enqueue(deployment.id);
    return deployment;
  }

  /**
   * Shared ownership check for the project a deployment belongs to.
   * Throws 404 (never 403) to hide whether the project even exists.
   */
  private async assertProjectOwned(ownerId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException();
  }
}
