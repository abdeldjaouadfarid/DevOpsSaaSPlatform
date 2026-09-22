import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const RECENT_DEPLOYMENTS_LIMIT = 10;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ownerId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, ownerId },
      include: {
        deployments: {
          orderBy: { startedAt: 'desc' },
          take: RECENT_DEPLOYMENTS_LIMIT,
        },
      },
    });
    if (!project) throw new NotFoundException();
    return project;
  }

  create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, ownerId },
    });
  }

  async update(ownerId: string, id: string, dto: UpdateProjectDto) {
    await this.assertOwned(ownerId, id);
    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async remove(ownerId: string, id: string) {
    await this.assertOwned(ownerId, id);
    await this.prisma.project.delete({ where: { id } });
  }

  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const found = await this.prisma.project.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException();
  }
}
