import { NotFoundException } from '@nestjs/common';
import { DeploymentStatus, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentQueueService } from '../queue/deployment/deployment-queue.service';
import { DeploymentsService } from './deployments.service';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let prisma: DeepMockProxy<PrismaClient>;
  let queue: DeepMockProxy<DeploymentQueueService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    queue = mockDeep<DeploymentQueueService>();
    service = new DeploymentsService(prisma as unknown as PrismaService, queue);
  });

  describe('trigger', () => {
    it('creates a PENDING deployment and enqueues the job when the project is owned', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' } as never);
      prisma.deployment.create.mockResolvedValue({
        id: 'd1',
        projectId: 'p1',
        commitSha: 'abc',
        status: DeploymentStatus.PENDING,
      } as never);

      const result = await service.trigger('owner-1', 'p1', 'abc');

      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: { projectId: 'p1', commitSha: 'abc', status: DeploymentStatus.PENDING },
      });
      expect(queue.enqueue).toHaveBeenCalledWith('d1');
      expect(result.id).toBe('d1');
    });

    it('throws NotFoundException and does not enqueue when the project is not owned', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.trigger('owner-1', 'other', 'abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.deployment.create).not.toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the deployment does not belong to the caller', async () => {
      prisma.deployment.findFirst.mockResolvedValue(null);
      await expect(service.findOne('owner-1', 'd1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
