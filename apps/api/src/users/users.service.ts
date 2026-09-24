// UsersService — read-only user lookups used by the /users routes.
// Kept minimal because most write paths live in AuthService.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up a user by id and return the "safe" projection (no passwordHash).
   * Throws 404 if the row is gone (e.g., deleted between token issuance
   * and this call). The explicit select acts as a safety net against
   * accidentally leaking new sensitive columns.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }
}
