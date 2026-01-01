import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { ConfigController } from './config/config.controller';
import { ConfigService } from './config/config.service';
import { TelemetryInterceptor } from './telemetry.interceptor';

@Module({
  controllers: [AskController, ConfigController],
  providers: [
    AskService,
    ConfigService,
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
})
export class AppModule {}
