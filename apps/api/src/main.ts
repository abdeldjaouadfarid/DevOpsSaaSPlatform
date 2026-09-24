// Bootstrap entrypoint for the DevOps SaaS Platform API.
// This file wires all the process-level concerns (security headers, CORS,
// validation, docs, port binding) around the NestJS application instance
// that AppModule composes.
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Build the Nest application, apply cross-cutting middleware, mount
 * Swagger UI (dev-only by default), and start the HTTP listener.
 *
 * Order matters: helmet + CORS must be registered before the app starts
 * listening; ValidationPipe must be global so every controller inherits it;
 * Swagger reads the fully-composed app so it must run after DI is ready.
 */
async function bootstrap(): Promise<void> {
  // NestFactory.create instantiates every module, resolves dependencies,
  // and returns an Express-backed application ready for middleware.
  const app = await NestFactory.create(AppModule);

  // Config values are read from validated env (see config/env.validation.ts).
  // getOrThrow makes boot fail loudly if a required var is missing rather
  // than degrading at runtime with a confusing null.
  const config = app.get(ConfigService);
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');

  // helmet sets a battery of secure-default HTTP response headers
  // (X-Frame-Options, CSP scaffold, HSTS in production, etc.).
  app.use(helmet());
  // Restrict cross-origin requests to the configured dashboard origin only.
  // `credentials: true` lets the browser send cookies / auth headers.
  app.enableCors({ origin: corsOrigin, credentials: true });

  // Global validation pipeline for every incoming request body / param /
  // query. Rules:
  //   whitelist: strip properties not declared on the DTO
  //   forbidNonWhitelisted: reject requests that include unknown props
  //     (surfaces frontend/backend contract drift as 400s instead of
  //     silently discarding data)
  //   transform: coerce plain objects to DTO classes so class-validator
  //     decorators actually run and pipes like ParseIntPipe apply.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Swagger UI is opt-in via SWAGGER_ENABLED; if unset, it's on for every
  // environment except production. That keeps /docs available in dev and
  // staging without exposing implementation detail on the public API.
  const swaggerEnabled = config.get<boolean>('SWAGGER_ENABLED') ?? nodeEnv !== 'production';
  if (swaggerEnabled) {
    // DocumentBuilder describes the API-level metadata. addBearerAuth
    // registers the "Authorize" flow so protected endpoints can be tried
    // right from the Swagger UI page.
    const docConfig = new DocumentBuilder()
      .setTitle('DevOps SaaS Platform API')
      .setDescription('Projects, deployments, and auth for the DevOps SaaS Platform')
      .setVersion('2.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    // createDocument scans every controller/route decorator and builds
    // an OpenAPI 3 document; setup mounts the interactive HTML at /docs
    // and the raw JSON at /docs-json.
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      // Preserve the pasted JWT across page reloads for a smoother demo.
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Start listening on the configured port and log helpful URLs so the
  // developer knows exactly where to click after boot.
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port} (env: ${nodeEnv})`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://localhost:${port}/docs`);
  }
}

// Kick off bootstrap. If anything above throws (bad env, DB unreachable at
// PrismaService.onModuleInit, port already bound, …) we log and exit
// non-zero so process supervisors restart us instead of silently hanging.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
