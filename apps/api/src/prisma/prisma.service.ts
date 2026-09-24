// PrismaService wraps PrismaClient so it can participate in Nest's
// dependency-injection lifecycle. It's registered as a provider in a
// @Global module (prisma.module.ts) so any feature service can inject it
// without re-importing PrismaModule.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Called once when the Nest module container has finished initializing.
   * Opens the pooled DB connection so the first HTTP request doesn't pay
   * the connect latency. If the DB is unreachable, this throws and the
   * whole bootstrap fails (which is the desired behaviour — better to
   * exit than to serve traffic against a broken DB).
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  /**
   * Called on graceful shutdown (SIGTERM, app.close in tests). Releases
   * the DB connection pool so the process can exit cleanly instead of
   * hanging on open sockets.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
