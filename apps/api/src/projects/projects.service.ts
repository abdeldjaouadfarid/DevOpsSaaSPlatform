// ProjectsService — CRUD for Project rows, always scoped to a single owner.
//
// Every read/write filters by ownerId so users can never touch each
// other's projects, even if they somehow guess a UUID. When an owner
// mismatch is detected we throw 404 rather than 403 so the API doesn't
// leak the existence of resources you're not allowed to see.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

// How many recent deployments to inline on GET /projects/:id. Kept small
// so the response stays fast; use GET /projects/:id/deployments for more.
const RECENT_DEPLOYMENTS_LIMIT = 10;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List every project owned by the caller, newest first. No pagination
   * yet — most users will have a handful of projects for now; add
   * cursors when someone actually needs them.
   */
  list(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch one project (with its recent deployments) if it belongs to the
   * caller; otherwise 404. Using findFirst instead of findUnique lets us
   * apply the ownerId filter in the same query — no separate ownership
   * check needed.
   */
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

  /**
   * Create a project, forcing the ownerId from the JWT (never trust a
   * body-supplied ownerId). A duplicate (ownerId, name) will surface as
   * a Prisma P2002 and be mapped to 409 by PrismaExceptionFilter.
   */
  create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { ...dto, ownerId },
    });
  }

  /**
   * Partial-update a project after verifying ownership. We do the
   * ownership check as a separate SELECT to keep the update statement
   * simple and to preserve the 404-vs-403 semantics.
   */
  async update(ownerId: string, id: string, dto: UpdateProjectDto) {
    await this.assertOwned(ownerId, id);
    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete a project. Cascade rules on the schema also drop its
   * deployments; there's no soft-delete today.
   */
  async remove(ownerId: string, id: string) {
    await this.assertOwned(ownerId, id);
    await this.prisma.project.delete({ where: { id } });
  }

  /**
   * Shared ownership guard used by update/remove. Extracted to keep the
   * public methods readable and to guarantee both paths use identical
   * (and 404-not-403) semantics.
   */
  private async assertOwned(ownerId: string, id: string): Promise<void> {
    const found = await this.prisma.project.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException();
  }
}
