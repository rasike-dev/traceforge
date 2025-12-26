// apps/api/src/main.ts
import { initTelemetry } from '@traceforge/telemetry';

// MUST be first — before Nest or any HTTP libs load
initTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TraceTagsInterceptor } from './telemetry/trace-tags.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TraceTagsInterceptor());

  await app.listen(3000);
}

bootstrap();
