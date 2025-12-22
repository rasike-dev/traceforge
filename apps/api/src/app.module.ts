import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { TelemetryInterceptor } from './telemetry.interceptor';

@Module({
  controllers: [AskController],
  providers: [
    AskService,
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
})
export class AppModule {}
