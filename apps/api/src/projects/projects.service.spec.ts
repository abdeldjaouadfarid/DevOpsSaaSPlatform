import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new ProjectsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('sets ownerId from the caller', async () => {
      prisma.project.create.mockResolvedValue({ id: 'p1' } as never);
      await service.create('owner-1', { name: 'demo', repoUrl: 'https://github.com/x/y' });
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { name: 'demo', repoUrl: 'https://github.com/x/y', ownerId: 'owner-1' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the project belongs to someone else', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.findOne('owner-1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the project (with recent deployments) when owned by the caller', async () => {
      const project = { id: 'p1', ownerId: 'owner-1', deployments: [] };
      prisma.project.findFirst.mockResolvedValue(project as never);
      await expect(service.findOne('owner-1', 'p1')).resolves.toEqual(project);
    });
  });

  describe('update', () => {
    it('rejects updates to a project the caller does not own', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.update('owner-1', 'p1', { name: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('applies partial updates when owned', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'p1' } as never);
      prisma.project.update.mockResolvedValue({ id: 'p1', name: 'renamed' } as never);
      await service.update('owner-1', 'p1', { name: 'renamed' });
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'renamed' },
      });
    });
  });

  describe('remove', () => {
    it('rejects deletes on a project the caller does not own', async () => {
      prisma.project.findFirst.mockResolvedValue(null);
      await expect(service.remove('owner-1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });
  });
});
