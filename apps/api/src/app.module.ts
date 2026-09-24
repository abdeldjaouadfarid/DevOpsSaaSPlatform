// Root module for the DevOps SaaS Platform API.
//
// It composes every feature module (auth, users, projects, deployments,
// health, queue) plus the cross-cutting global guards and filters that
// affect every incoming request.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { validateEnv } from './config/env.validation';
import { DeploymentsModule } from './deployments/deployments.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queue/queue.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // ConfigModule loads .env and validates it via Zod (env.validation.ts).
    // isGlobal makes ConfigService injectable everywhere without re-import;
    // cache avoids re-parsing env on every getOrThrow call.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Global rate limiter: 100 requests / minute / IP by default.
    // Individual routes can override with @Throttle(...) (e.g., /auth/login
    // narrows to 5/minute to slow credential-stuffing attacks).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // PrismaModule is a @Global module that exposes a shared PrismaService.
    PrismaModule,
    // QueueModule.register() is a dynamic import: it wires BullMQ against
    // Redis and conditionally mounts Bull Board at /admin/queues.
    QueueModule.register(),
    // Feature modules — each owns a slice of the domain.
    AuthModule,
    UsersModule,
    ProjectsModule,
    DeploymentsModule,
    HealthModule,
  ],
  providers: [
    // APP_GUARD registers guards that run on EVERY request in declaration
    // order. JwtAuthGuard first so authentication is checked before rate
    // limiting spends a slot on unauthenticated traffic (except @Public()
    // routes, which JwtAuthGuard short-circuits).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // APP_FILTER catches Prisma's typed errors and turns them into
    // properly-shaped HTTP responses (409 for unique violations, 404 for
    // missing records) instead of leaking a 500 with a stack trace.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
