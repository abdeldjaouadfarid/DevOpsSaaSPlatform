import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

@Injectable()
export class DeploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(ownerId: string, projectId: string, limit = DEFAULT_LIMIT) {
    const cap = Math.min(Math.max(1, limit), MAX_LIMIT);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException();

    return this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: cap,
    });
  }

  async findOne(ownerId: string, id: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, project: { ownerId } },
    });
    if (!deployment) throw new NotFoundException();
    return deployment;
  }
}
