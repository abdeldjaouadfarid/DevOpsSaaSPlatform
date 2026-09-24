// QueueModule — wires BullMQ (queue + worker) plus the optional Bull
// Board admin UI.
//
// Marked @Global so any feature module can inject DeploymentQueueService
// without having to add QueueModule to its own imports. Registered
// exactly once from AppModule.
//
// register() is a dynamic-module factory instead of a plain @Module
// export because Bull Board's imports need to be conditionally added
// based on env — Nest's @Module decorator can't do that at declaration
// time.
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DeploymentQueueService } from './deployment/deployment-queue.service';
import { DeploymentProcessor } from './deployment/deployment.processor';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Reads env directly (not via ConfigService) because register() runs at
 * module-declaration time — before Nest's DI container exists.
 * Rule:
 *   BULL_BOARD_ENABLED=true → force on
 *   BULL_BOARD_ENABLED=false → force off
 *   unset → on unless NODE_ENV === 'production'
 */
function bullBoardEnabledFromEnv(): boolean {
  const flag = process.env.BULL_BOARD_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

@Global()
@Module({})
export class QueueModule {
  /**
   * Compose the queue module.
   *
   * Always includes:
   *   - BullMQ root config (Redis connection, default job options)
   *   - The 'deployments' queue registration
   *
   * Optionally includes:
   *   - Bull Board (only in non-prod or when explicitly enabled)
   */
  static register(): DynamicModule {
    const imports: DynamicModule['imports'] = [
      // Async factory for the root BullMQ config — pulls Redis details
      // from validated env via ConfigService. defaultJobOptions apply
      // to every job unless overridden per-enqueue.
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          connection: {
            host: config.getOrThrow<string>('REDIS_HOST'),
            port: config.getOrThrow<number>('REDIS_PORT'),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
          },
          defaultJobOptions: {
            // Keep the last 100 successes / 500 failures for Bull Board
            // inspection. Beyond that BullMQ prunes older jobs from
            // Redis so memory stays bounded.
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        }),
      }),
      // Register the 'deployments' queue by name so @InjectQueue works.
      BullModule.registerQueue({ name: QUEUE_NAMES.DEPLOYMENTS }),
    ];

    // Bull Board wiring: mount the admin UI on /admin/queues (backed by
    // Express) and register the deployments queue as a data source for
    // it. Only pushed onto imports when the flag says so.
    if (bullBoardEnabledFromEnv()) {
      imports.push(
        BullBoardModule.forRoot({
          route: '/admin/queues',
          adapter: ExpressAdapter,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        BullBoardModule.forFeature({
          name: QUEUE_NAMES.DEPLOYMENTS,
          // Type cast: bullmq >= 5.12 widened JobProgress to include
          // `string`, but @bull-board/api's BaseAdapter still declares
          // `number | object`. The runtime shape is compatible; this
          // cast satisfies the type checker until bull-board catches up.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          adapter: BullMQAdapter as any,
        }),
      );
    }

    return {
      module: QueueModule,
      imports,
      // DeploymentProcessor is a provider so Nest instantiates it once at
      // boot; that instantiation is what registers the BullMQ worker
      // (it calls super() in the constructor).
      providers: [DeploymentQueueService, DeploymentProcessor],
      // Re-export BullModule so anyone who imports QueueModule
      // (e.g., in a test) can also inject queues directly.
      exports: [DeploymentQueueService, BullModule],
    };
  }
}
