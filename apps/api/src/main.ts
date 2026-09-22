// Bootstrap the NestJS application
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');

  app.use(helmet());
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerEnabled = config.get<boolean>('SWAGGER_ENABLED') ?? nodeEnv !== 'production';
  if (swaggerEnabled) {
    const docConfig = new DocumentBuilder()
      .setTitle('DevOps SaaS Platform API')
      .setDescription('Projects, deployments, and auth for the DevOps SaaS Platform')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port} (env: ${nodeEnv})`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://localhost:${port}/docs`);
  }
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
