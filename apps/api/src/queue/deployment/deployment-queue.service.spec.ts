import { Queue } from 'bullmq';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { JOB_NAMES } from '../queue.constants';
import { DeploymentQueueService } from './deployment-queue.service';

describe('DeploymentQueueService', () => {
  let service: DeploymentQueueService;
  let queue: DeepMockProxy<Queue>;

  beforeEach(() => {
    queue = mockDeep<Queue>();
    service = new DeploymentQueueService(queue as unknown as Queue);
  });

  it('enqueues a run-deployment job with the deploymentId payload and retry config', async () => {
    queue.add.mockResolvedValue({ id: 'job-1' } as never);

    await service.enqueue('deployment-42');

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, payload, opts] = queue.add.mock.calls[0];
    expect(jobName).toBe(JOB_NAMES.RUN_DEPLOYMENT);
    expect(payload).toEqual({ deploymentId: 'deployment-42' });
    expect(opts).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });
});
