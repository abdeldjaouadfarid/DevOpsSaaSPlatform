import { DeploymentStatus, PrismaClient } from '@prisma/client';
import type { Job } from 'bullmq';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { DeploymentProcessor } from './deployment.processor';
import type { RunDeploymentJobData } from './run-deployment.job';

// Skip the artificial per-step delay in tests.
jest.useFakeTimers({ doNotFake: ['nextTick'] });

const makeJob = (deploymentId = 'd-1', attemptsMade = 0): Job<RunDeploymentJobData> =>
  ({ data: { deploymentId }, attemptsMade }) as unknown as Job<RunDeploymentJobData>;

const runWithAdvancingTimers = async (fn: () => Promise<void>): Promise<void> => {
  const promise = fn();
  // Advance past both 500ms sleeps in the processor.
  await Promise.resolve();
  jest.advanceTimersByTime(1000);
  await promise;
};

describe('DeploymentProcessor', () => {
  let processor: DeploymentProcessor;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    processor = new DeploymentProcessor(prisma as unknown as PrismaService);
  });

  it('walks a successful deployment through BUILDING → DEPLOYING → SUCCESS', async () => {
    prisma.deployment.findUnique.mockResolvedValue({
      id: 'd-1',
      projectId: 'p-1',
      commitSha: 'abc123',
      status: DeploymentStatus.PENDING,
      logs: null,
      startedAt: new Date(),
      finishedAt: null,
    } as never);
    prisma.deployment.findUniqueOrThrow.mockResolvedValue({ logs: null } as never);

    await runWithAdvancingTimers(() => processor.process(makeJob()));

    const statuses = prisma.deployment.update.mock.calls.map(
      (call) => (call[0] as { data: { status: DeploymentStatus } }).data.status,
    );
    expect(statuses).toEqual([
      DeploymentStatus.BUILDING,
      DeploymentStatus.DEPLOYING,
      DeploymentStatus.SUCCESS,
    ]);

    const lastCall = prisma.deployment.update.mock.calls.at(-1)![0] as {
      data: { status: DeploymentStatus; finishedAt: Date };
    };
    expect(lastCall.data.finishedAt).toBeInstanceOf(Date);
  });

  it('marks a deployment FAILED when commitSha === "FAIL" and rethrows', async () => {
    prisma.deployment.findUnique.mockResolvedValue({
      id: 'd-2',
      projectId: 'p-1',
      commitSha: 'FAIL',
      status: DeploymentStatus.PENDING,
      logs: null,
      startedAt: new Date(),
      finishedAt: null,
    } as never);
    prisma.deployment.findUniqueOrThrow.mockResolvedValue({ logs: null } as never);

    await expect(runWithAdvancingTimers(() => processor.process(makeJob('d-2')))).rejects.toThrow(
      /Simulated failure/,
    );

    const statuses = prisma.deployment.update.mock.calls.map(
      (call) => (call[0] as { data: { status: DeploymentStatus } }).data.status,
    );
    expect(statuses).toEqual([
      DeploymentStatus.BUILDING,
      DeploymentStatus.DEPLOYING,
      DeploymentStatus.FAILED,
    ]);

    const lastCall = prisma.deployment.update.mock.calls.at(-1)![0] as {
      data: { logs: string };
    };
    expect(lastCall.data.logs).toMatch(/ERROR: Simulated failure/);
  });

  it('throws when the deployment row does not exist', async () => {
    prisma.deployment.findUnique.mockResolvedValue(null);
    await expect(processor.process(makeJob('missing'))).rejects.toThrow(/not found/);
    expect(prisma.deployment.update).not.toHaveBeenCalled();
  });
});
